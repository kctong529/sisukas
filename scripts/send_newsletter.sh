#!/bin/bash

# Load HTML content from the generated file
html_content=$(<public/newsletter.html)

# Read emails from the file and format them as a JSON array
email_list=$(jq -Rn '[inputs]' < email_list.txt)

# Send the email using Resend API with jq for proper escaping
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg from "newsletter@sisukas.eu" \
    --argjson bcc "$email_list" \
    --arg subject "Sisukas Newsletter - Upcoming Courses" \
    --arg html_content "$html_content" \
    '{from: $from, to: "subscribers@sisukas.eu", bcc: $bcc, subject: $subject, html: $html_content}')"