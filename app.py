import re
from flask import Flask, jsonify, render_template, send_from_directory
import requests
import feedparser
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='templates')

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_for_text(html_content):
    """Converts HTML content to plain text for tweet drafting, stripping tags and resolving links."""
    cleaned = html_content
    # Replace standard tag groupings
    cleaned = re.sub(r'<code>(.*?)</code>', r'\1', cleaned)
    cleaned = re.sub(r'<strong>(.*?)</strong>', r'\1', cleaned)
    cleaned = re.sub(r'<em>(.*?)</em>', r'\1', cleaned)
    
    # Replace links: convert <a href="url">text</a> to "text" (and maybe append the main release notes link at the end)
    cleaned = re.sub(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', r'\2', cleaned)
    
    # Strip all other HTML tags
    cleaned = re.sub(r'<[^>]+>', '', cleaned)
    # Clean up whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def classify_update_domain(text):
    text_lower = text.lower()
    domains = []
    explanations = []
    
    # Data Engineer
    de_keywords = ['query', 'table', 'view', 'partition', 'cluster', 'load', 'export', 'ingest', 'schema', 'sql', 'dataset', 'format', 'parquet', 'avro', 'csv', 'json', 'dbt', 'spark', 'hadoop', 'dataproc', 'stream', 'pipeline', 'storage', 'metadata', 'write', 'insert', 'upsert', 'merge']
    if any(k in text_lower for k in de_keywords):
        domains.append("Data Engineer")
        explanations.append("Optimizes data storage, pipelines, and schema partitioning.")
        
    # Data Analyst
    da_keywords = ['analytics', 'bi', 'dashboard', 'report', 'chart', 'visualization', 'looker', 'tableau', 'excel', 'sheets', 'ml', 'predict', 'forecast', 'model', 'regression', 'clustering', 'classification', 'search', 'geospatial', 'gis', 'window function', 'aggregate', 'group by', 'count', 'sum', 'avg', 'statistical']
    if any(k in text_lower for k in da_keywords):
        domains.append("Data Analyst")
        explanations.append("Introduces new query functions, analytic capabilities, or BI tools.")
        
    # Software Engineer
    se_keywords = ['api', 'client', 'library', 'sdk', 'python', 'java', 'go', 'dotnet', 'node', 'js', 'c#', 'ruby', 'php', 'endpoint', 'request', 'response', 'payload', 'oauth', 'credentials', 'driver', 'jdbc', 'odbc', 'connection']
    if any(k in text_lower for k in se_keywords):
        domains.append("Software Engineer")
        explanations.append("Changes application connectivity, client SDK interfaces, or API endpoints.")
        
    # Cloud Engineer / DevOps
    ce_keywords = ['iam', 'policy', 'permission', 'role', 'access', 'security', 'encryption', 'kms', 'network', 'vpc', 'firewall', 'ip', 'billing', 'cost', 'price', 'reservation', 'slot', 'capacity', 'monitoring', 'log', 'alert', 'audit', 'terraform', 'gcloud', 'cli', 'governance', 'compliance']
    if any(k in text_lower for k in ce_keywords):
        domains.append("Cloud Engineer")
        explanations.append("Affects cloud IAM, resource sizing (slots/billing), monitoring, or networking.")
        
    if not domains:
        domains = ["General Technical"]
        explanations.append("General BigQuery platform enhancement and system improvements.")
        
    return domains, " | ".join(explanations)

def parse_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        if response.status_code != 200:
            return None, f"Failed to fetch feed: HTTP {response.status_code}"
        
        feed = feedparser.parse(response.content)
        
        if feed.bozo:
            pass
            
        entries = []
        for entry in feed.entries:
            # Extract date/title
            title_date = entry.get('title', 'Unknown Date')
            entry_id = entry.get('id', '')
            link = entry.get('link', 'https://cloud.google.com/bigquery/docs/release-notes')
            
            # The date in the feed is usually in the format: YYYY-MM-DD
            updated_str = entry.get('updated', '')
            formatted_date = title_date
            if updated_str:
                try:
                    dt = datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
                    formatted_date = dt.strftime('%B %d, %Y')
                except ValueError:
                    pass
            
            # Parse HTML content into separate updates by <h3>
            html = entry.get('summary', '') or (entry.get('content', [{}])[0].get('value', '') if entry.get('content') else '')
            parts = re.split(r'<h3>(.*?)</h3>', html)
            
            day_updates = []
            
            if len(parts) == 1:
                # No <h3> headers
                content_html = parts[0].strip()
                if content_html:
                    plain_text = clean_html_for_text(content_html)
                    domains, explanation = classify_update_domain(plain_text)
                    day_updates.append({
                        'id': f"{entry_id}-0",
                        'type': 'Update',
                        'html': content_html,
                        'text': plain_text,
                        'domains': domains,
                        'domain_explanation': explanation
                    })
            else:
                # Text before the first <h3> (if any)
                first_part = parts[0].strip()
                if first_part:
                    plain_text = clean_html_for_text(first_part)
                    domains, explanation = classify_update_domain(plain_text)
                    day_updates.append({
                        'id': f"{entry_id}-first",
                        'type': 'General',
                        'html': first_part,
                        'text': plain_text,
                        'domains': domains,
                        'domain_explanation': explanation
                    })
                
                # Elements after split alternate between Heading and Body
                update_index = 1
                for i in range(1, len(parts), 2):
                    if i + 1 < len(parts):
                        heading = parts[i].strip()
                        body = parts[i+1].strip()
                        if heading or body:
                            plain_text = clean_html_for_text(body)
                            domains, explanation = classify_update_domain(plain_text)
                            day_updates.append({
                                'id': f"{entry_id}-{update_index}",
                                'type': heading,
                                'html': body,
                                'text': plain_text,
                                'domains': domains,
                                'domain_explanation': explanation
                            })
                            update_index += 1
            
            entries.append({
                'date': title_date,
                'iso_date': updated_str,
                'link': link,
                'updates': day_updates
            })
            
        return entries, None
    except Exception as e:
        return None, str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    releases, error = parse_release_notes()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'data': releases})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
