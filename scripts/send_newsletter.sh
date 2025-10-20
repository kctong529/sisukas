#!/bin/bash

# Read emails from the file and format them as a JSON array
email_list=$(jq -Rn '[inputs]' < email_list.txt)

# Get current issue number
issue_number=$(date +'%Y Week %V')

# Construct subject line
subject="Sisukas Newsletter - $issue_number"

# Create JSON payload and write to temporary file
temp_payload=$(mktemp)
jq -n \
  --arg from "newsletter@sisukas.eu" \
  --arg to "Sisukas Subscribers <kichun.tong@aalto.fi>" \
  --argjson bcc "$email_list" \
  --arg subject "$subject" \
  --rawfile html_content course-browser/public/newsletter.html \
  '{from: $from, to: $to, bcc: $bcc, subject: $subject, html: $html_content}' > "$temp_payload"

# Send the email using Resend API
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary "@$temp_payload"

# Clean up
rm "$temp_payload"