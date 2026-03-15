https://www.firecrawl.dev/app

curl -X POST 'https://api.firecrawl.dev/v2/scrape' \
-H 'Authorization: Bearer fc-9b00a33f1d104e38931173fef5f83ea2' \
-H 'Content-Type: application/json' \
-d $'{
  "url": "firecrawl.dev"
}'