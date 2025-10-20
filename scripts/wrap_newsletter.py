from bs4 import BeautifulSoup

print("Starting HTML wrapping script...")

# Read the existing HTML content
with open('course-browser/public/newsletter.html', 'r', encoding='utf-8') as f:
    original_html = f.read()
print("Read original_content.html successfully.")

# Parse with BeautifulSoup
soup = BeautifulSoup(original_html, 'html.parser')

# Extract content inside <body>
body_content = soup.body.decode_contents()  # returns inner HTML inside body
print(f"Extracted {len(body_content)} characters from the <body> tag.")

# Prepare new head and wrapping HTML
new_head = """
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upcoming Course Enrolments</title>
    <style>
        table {
            border-collapse: collapse;
            width: 98%;
            margin: 20px auto;
        }
        h2 {
            text-align: center;
            color: #610396;
        }
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
        }
        a {
            color: #610396;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        hr {
            border: 0;
            border-top: 1px solid #ddd;
            margin: 40px 0;
        }
        .content-wrapper {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            margin-top: 20px;
        }
        .newsletter-table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .newsletter-table th, .newsletter-table td {
            border: 1px solid #ccc;
            padding: 6px;
            text-align: left;
        }
        .newsletter-table th {
            background-color: #610396;
            color: white;
        }
        .subscription-container {
          font-family: sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 20vh;
        }
        .info-container {
          font-family: sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          padding-bottom: 60px;
        }
        .info-text {
            width: 400px;
        }
        #subscribe-form {
          background: white;
          padding: 1.5rem 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        input[type="email"] {
          padding: 0.5rem;
          width: 240px;
          border: 1px solid #ccc;
          border-radius: 6px;
          margin-right: 0.5rem;
        }
        button {
          padding: 0.5rem 1rem;
          border: none;
          background: #bf99d6;
          color: white;
          border-radius: 6px;
          cursor: pointer;
        }
        button:hover {
          background: #610396;
        }
        /* Message box styling */
        #message {
            height: 0px;
            text-align: right;
            border-radius: 5px;
            padding-top: 0.3em;
            font-size: 0.7em;
            font-style: italic;
        }

        /* Success message style */
        #message.success {
          color: #328e6e;
        }

        /* Error message style */
        #message.error {
          color: #f75a5a;
        }

        /* Submitting message style */
        #message.submitting {
          color: #856404;
        }
    </style>
</head>
"""

# Prepare body open
body_open = """
<body>
    <div class="info-container">
        <div class="info-text">
            <h2>Stay Updated with Sisukas</h2>
            <p>Want to stay informed about important course details? Subscribe to the Sisukas newsletter! This issue focuses on key registration deadlines and exam dates, but future issues will feature even more in-depth information to help you navigate your studies. If you're unsure, don’t worry — this issue is available publicly, and future ones will be too. You can always check out the content before deciding whether to subscribe. We’re here to keep you updated, whether you sign up or not!</p>
        </div>
    </div>
    <div class="subscription-container">
        <form id="subscribe-form">
            <h2>Subscribe to our Newsletter</h2>
            <input type="email" name="email" placeholder="Your email address" required />
            <button type="submit">Subscribe</button>
            <div id="message"></div>
        </form>
    </div>
    <script>
    document.addEventListener("DOMContentLoaded", () => {
      const form = document.getElementById("subscribe-form");
      const messageBox = document.getElementById("message");

      form.addEventListener("submit", (e) => {
        e.preventDefault();

        messageBox.className = 'submitting';
        messageBox.textContent = "Submitting...";

        const formData = new FormData(form);

        fetch("https://script.google.com/macros/s/AKfycbxjmes-iVGAnv7sWh8dB0rZLx6fAXXXEzlemFDtnhkYBqYtmrTTdol_epoXxoFD8sjV/exec", {
          method: "POST",
          mode: "no-cors",
          body: formData
        })
        .then(() => {
          messageBox.className = 'success';
          messageBox.textContent = "Thanks for subscribing!";
          form.reset();
        })
        .catch(() => {
          messageBox.className = 'error';
          messageBox.textContent = "Something went wrong. Please try again.";
        });
      });
    });
    </script>
"""

# Combine everything into a final HTML document
final_html = f"""
<!DOCTYPE html>
<html lang="en">
{new_head}
{body_open}
{body_content}
</body>
</html>
"""

# Write the wrapped HTML to a new file
with open('course-browser/public/newsletter.html', 'w') as f:
    f.write(final_html)

print("Written course-browser/public/newsletter.html successfully.")
print("Script finished.")