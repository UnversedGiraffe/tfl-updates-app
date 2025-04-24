# tfl-status-dashboard
A simple dashboard displaying live Transport for London line statuses using AWS Lambda, API Gateway, and Amplify Hosting

# TfL Live Status Dashboard

A simple, responsive web application displaying live line status information for selected Transport for London (TfL) services. This project serves as a portfolio piece demonstrating a serverless backend architecture on AWS and modern frontend deployment techniques.

**[View Live Demo](https://main.dkjebwugayu2x.amplifyapp.com/)**

## Description

This dashboard provides real-time status updates for TfL lines (initially focusing on the Tube). It fetches data from the official TfL Unified API via a custom-built serverless backend on AWS and updates automatically every 60 seconds. The frontend is designed to be responsive and mobile-friendly.

## Features

* Displays live status for multiple TfL lines (e.g., Tube lines).
* Data fetched from the official TfL API via a serverless backend.
* Automatic status refresh every 60 seconds.
* Backend caching implemented using Amazon DynamoDB (60-second TTL) to improve performance and reduce external API calls
* Responsive design for different screen sizes.
* Deployed using AWS Amplify Hosting with CI/CD from GitHub.

## Tech Stack

**Frontend:**
* HTML5
* CSS3 (including Flexbox, Grid, Media Queries)
* JavaScript (Vanilla JS, Fetch API, DOM Manipulation, `setInterval`)

**Backend (Serverless API):**
* **API Gateway:** REST API endpoint with Lambda Proxy integration, CORS enabled.
**Amazon DynamoDB:** Used for caching TfL API responses.
* **AWS Lambda:** Backend logic written in Python 3.x, fetches data from TfL API, parses and simplifies the response.
* **IAM Roles:** Used for granting necessary permissions to Lambda.
* **CloudWatch Logs:** Used for Lambda logging and debugging.

**Deployment & Hosting:**
* **Frontend:** AWS Amplify Hosting (Managed CI/CD, Hosting, CDN via CloudFront internally)
* **Source Control:** GitHub

**External Dependencies:**
* Transport for London (TfL) Unified API

## Architecture Overview

The frontend (HTML/CSS/JS) hosted on AWS Amplify calls a backend REST API endpoint hosted on API Gateway. API Gateway uses Lambda Proxy Integration to trigger a Python Lambda function. This function first checks an Amazon DynamoDB table for a recent cached response. If no valid cache entry is found, it retrieves an API key from its environment variables, calls the external TfL Unified API to get the latest line statuses, parses the JSON response, simplifies it, writes the simplified result back to the DynamoDB cache with a TTL, and sends the simplified data back through API Gateway to the frontend. The frontend JavaScript then updates the display dynamically.

## Setup & Running

The live version can be accessed via the demo link above. The frontend code is self-contained in this repository. The backend API infrastructure (API Gateway, Lambda, a DynamoDB table named 'TflStatusCache') needs to be deployed separately on AWS and requires two environment variables configured for the Lambda function: TFL_APP_KEY (containing the TfL API key) and DYNAMODB_TABLE_NAME (containing the name of the cache table). The API_BASE_URL constant in script.js must point to the deployed API Gateway endpoint.

## Future Improvements (Potential)

* Add status display for more TfL modes (DLR, Overground, Elizabeth Line, etc.).
* Refine CSS and visual design, potentially adding official TfL line colors.
* Enhance frontend error handling and loading states.
* Add a Journey Planning feature (Phase 2).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
