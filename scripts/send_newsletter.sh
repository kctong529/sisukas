#!/bin/bash

# Load HTML content from the generated file
html_content=$(<public/newsletter.html)

# Read emails from the file and format them as a JSON array
email_list=$(jq -Rn '[inputs]' < email_list.txt)

# Get current issue number
issue_number=$(date +'%Y Week %V')

# Construct subject line
subject="Sisukas Newsletter - $issue_number"

# Send the email using Resend API with jq for proper escaping
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n \
    --arg from "newsletter@sisukas.eu" \
    --arg to "Sisukas Subscribers <kichun.tong@aalto.fi>" \
    --argjson bcc "$email_list" \
    --arg subject "$subject" \
    --arg html_content "$html_content" \
    '{from: $from, to: $to, bcc: $bcc, subject: $subject, html: $html_content}')"
