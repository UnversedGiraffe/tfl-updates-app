import json
import os
import requests # Note: Needs to be packaged with deployment or added as a Lambda Layer
import boto3 # Added for DynamoDB
import time # Added for TTL calculation
from botocore.exceptions import ClientError # Added for specific boto3 error handling

# --- Configuration ---
# Retrieve TfL API key from environment variables
TFL_APP_KEY = os.environ.get('TFL_APP_KEY')

TFL_API_BASE_URL = "https://api.tfl.gov.uk/Line"
# Timeout for requests to the external TfL API (in seconds)
REQUEST_TIMEOUT = 10

# --- DynamoDB Cache Configuration ---
DYNAMODB_TABLE_NAME = os.environ.get('TFL_TABLE_NAME') # Make sure this matches your table name
CACHE_TTL_SECONDS = 60 # Cache items expire after 60 seconds

# Initialize DynamoDB client (outside handler for reuse)
try:
    dynamodb = boto3.resource('dynamodb')
    cache_table = dynamodb.Table(DYNAMODB_TABLE_NAME)
except Exception as e:
    print(f"CRITICAL ERROR: Failed to initialize DynamoDB resource/table: {e}")
    # Set to None so handler can check and fail gracefully
    cache_table = None

def _format_response(status_code, body_object):
    """Helper to format the response dictionary for API Gateway."""
    # Using the user's specific Amplify URL now
    origin = 'https://main.dkjebwugayu2x.amplifyapp.com' # Replace if URL changes
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin
            # Add other CORS headers if needed (usually handled by OPTIONS response)
            # 'Access-Control-Allow-Methods': 'GET,OPTIONS',
            # 'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': json.dumps(body_object)
    }

def _make_tfl_request(url):
    """
    Makes a request to the TfL API using only app_key and handles common errors.
    Returns the parsed JSON data or raises an exception.
    """
    endpoint_url = url.split('?')[0] 
    print(f"Calling TfL API endpoint: {endpoint_url}")
    try:
        if 'app_key=' not in url:
             print("CRITICAL ERROR: app_key parameter missing from TfL request URL construction.")
             raise ValueError("Internal configuration error: app_key missing.")

        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        tfl_data = response.json()
        return tfl_data
    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP Error from TfL API: {e.response.status_code} - {e.response.text}")
        raise e
    except requests.exceptions.Timeout:
        print(f"ERROR: Request to TfL API timed out after {REQUEST_TIMEOUT} seconds.")
        raise TimeoutError("Request to upstream service (TfL) timed out.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Network or Request Error calling TfL API: {e}")
        raise ConnectionError(f"Network error communicating with upstream service (TfL): {e}")
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to decode JSON response from TfL API. Response text: {response.text if 'response' in locals() else 'N/A'}")
        raise ValueError(f"Received invalid (non-JSON) response from upstream service (TfL): {e}")

def _extract_simplified_status(line_data):
    """
    Extracts line name and status description from a single line object
    returned by the TfL API. Handles missing data gracefully.
    """
    try:
        line_name = line_data.get('name', line_data.get('id', 'Unknown Line'))
        line_statuses = line_data.get('lineStatuses', [])
        if line_statuses:
            status_description = line_statuses[0].get('statusSeverityDescription', 'Status Unknown')
        else:
            status_description = 'Status Not Available'
        return {'line': line_name, 'status': status_description}
    except Exception as e:
        print(f"WARN: Error parsing line data: {line_data}. Error: {e}")
        return {'line': line_data.get('id', 'Parse Error'), 'status': 'Parse Error'}


# --- Main Handler ---

def lambda_handler(event, context):
    """
    AWS Lambda handler function for the TfL API Aggregator with DynamoDB Caching.
    Handles GET /lines/{lineId}/status and GET /modes/{modeIds}/status.
    Requires TFL_APP_KEY environment variable and DynamoDB table access.
    """
    print(f"Received event: {json.dumps(event)}")

    # --- 0. Initial Checks ---
    if cache_table is None:
         print("ERROR: DynamoDB table object not initialized.")
         return _format_response(500, {'error': 'Internal server configuration error (DB init).'})

    if not TFL_APP_KEY:
        print("ERROR: Missing TfL API key (TFL_APP_KEY) in environment variables.")
        return _format_response(500, {'error': 'Internal server configuration error (API Key).'})

    # --- 1. Route Request and Determine Cache Key ---
    cache_key = None
    tfl_request_url = None
    line_id = None # Keep track for error messages if needed
    mode_ids = None # Keep track for error messages if needed

    try:
        http_method = event.get('httpMethod')
        resource_path = event.get('resource')
        path_params = event.get('pathParameters', {})

        if resource_path == '/lines/{lineId}/status' and http_method == 'GET':
            line_id = path_params.get('lineId')
            if not line_id:
                 raise ValueError("Missing 'lineId' in path parameters.")
            print(f"Request identified for specific line status: lineId='{line_id}'")
            cache_key = f"line#{line_id.lower()}" # Use consistent key format
            tfl_request_url = f"{TFL_API_BASE_URL}/{line_id}/Status?app_key={TFL_APP_KEY}"

        elif resource_path == '/modes/{modeIds}/status' and http_method == 'GET':
            mode_ids = path_params.get('modeIds')
            if not mode_ids:
                 raise ValueError("Missing 'modeIds' in path parameters.")
            print(f"Request identified for mode status: modeIds='{mode_ids}'")
            cache_key = f"mode#{mode_ids.lower()}" # Use consistent key format
            tfl_request_url = f"{TFL_API_BASE_URL}/Mode/{mode_ids}/Status?app_key={TFL_APP_KEY}"

        else:
            print(f"WARN: Received request for unhandled path/method: {resource_path} {http_method}")
            return _format_response(404, {'error': 'Requested resource or method not found.'})

    except (AttributeError, KeyError, ValueError, TypeError) as e:
        print(f"ERROR: Invalid request format or missing parameters: {e}")
        return _format_response(400, {'error': f'Bad Request: {str(e)}'})
    except Exception as e:
         print(f"ERROR: Unexpected error processing input: {e}")
         return _format_response(500, {'error': 'Internal server error during request processing.'})


    # --- 2. Check Cache ---
    current_time = int(time.time())
    try:
        print(f"Checking cache with key: {cache_key}")
        response = cache_table.get_item(Key={'cache_key': cache_key})

        if 'Item' in response:
            item = response['Item']
            expiry_timestamp = item.get('expiry_timestamp')
            cached_data_str = item.get('cached_data')

            # Check if item exists, has data, has expiry, and is not expired
            if expiry_timestamp and cached_data_str and current_time < expiry_timestamp:
                print(f"Cache hit for key: {cache_key}")
                cached_data = json.loads(cached_data_str) # Parse the stored JSON string
                return _format_response(200, cached_data)
            elif expiry_timestamp and current_time >= expiry_timestamp:
                print(f"Cache expired for key: {cache_key}")
            else:
                 print(f"Cache item invalid for key: {cache_key} (missing data or expiry)")
        else:
            print(f"Cache miss for key: {cache_key}")

    except ClientError as e:
        # Log DynamoDB client errors but treat as cache miss
        print(f"WARN: DynamoDB GetItem error for key '{cache_key}': {e.response['Error']['Code']} - {e.response['Error']['Message']}. Proceeding as cache miss.")
    except Exception as e:
        # Log other unexpected errors during cache check but treat as cache miss
        print(f"WARN: Unexpected error during cache check for key '{cache_key}': {e}. Proceeding as cache miss.")


    # --- 3. Cache Miss/Expired: Call TfL API ---
    print(f"Proceeding to fetch fresh data from TfL for cache key: {cache_key}")
    try:
        tfl_data = _make_tfl_request(tfl_request_url)

        # --- 4. Parse and Transform Response ---
        simplified_result = []
        if isinstance(tfl_data, list):
             for line_info in tfl_data:
                  simplified_result.append(_extract_simplified_status(line_info))
        else:
             print(f"WARN: Expected a list response from TfL, but got type {type(tfl_data)}. Data: {tfl_data}")
             try:
                  simplified_result.append(_extract_simplified_status(tfl_data))
             except Exception as parse_err:
                   print(f"ERROR: Failed to parse unexpected non-list response: {parse_err}")
                   simplified_result = [] # Return empty if parsing fails

        print(f"Successfully processed TfL data. Result count: {len(simplified_result)}")

        # --- 5. Write to Cache ---
        # Only cache if we got a non-empty, valid result from TfL/parsing
        if simplified_result:
            try:
                expiry_ts = current_time + CACHE_TTL_SECONDS
                data_to_cache = json.dumps(simplified_result) # Store simplified data as JSON string

                print(f"Writing to cache with key: {cache_key}, TTL: {expiry_ts}")
                cache_table.put_item(
                    Item={
                        'cache_key': cache_key,
                        'cached_data': data_to_cache,
                        'expiry_timestamp': expiry_ts # This is the TTL attribute
                    }
                )
                print(f"Successfully wrote to cache for key: {cache_key}")
            except ClientError as e:
                # Log errors but don't fail the request if cache write fails
                print(f"WARN: Failed to write to cache for key '{cache_key}': {e.response['Error']['Code']} - {e.response['Error']['Message']}")
            except Exception as e:
                 print(f"WARN: Unexpected error during cache write for key '{cache_key}': {e}")


        # --- 6. Return Fresh Data ---
        return _format_response(200, simplified_result)

    # --- Error Handling for TfL API Call & Downstream Processing ---
    except requests.exceptions.HTTPError as e:
         status_code = 502
         error_message = f"Error from upstream service (TfL): Status Code {e.response.status_code}"
         if e.response.status_code == 404:
              status_code = 404
              param_name = 'Line ID(s)' if resource_path == '/lines/{lineId}/status' else 'Mode ID(s)'
              param_value = line_id if resource_path == '/lines/{lineId}/status' else mode_ids
              error_message = f"{param_name} '{param_value}' not found by the TfL API."
         elif e.response.status_code in [401, 403]:
             status_code = e.response.status_code
             error_message = "Authentication failed with upstream service (TfL). Check API Key (TFL_APP_KEY)."
         return _format_response(status_code, {'error': error_message})
    except TimeoutError as e:
         return _format_response(504, {'error': str(e)})
    except (ConnectionError, ValueError) as e:
         return _format_response(502, {'error': str(e)})
    except Exception as e:
         print(f"ERROR: An unexpected error occurred during TfL API call or data processing: {e}")
         return _format_response(500, {'error': 'An internal server error occurred.'})