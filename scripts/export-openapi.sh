#!/bin/bash
#
# Export OpenAPI specification from running server
#
# Usage:
#   ./scripts/export-openapi.sh [yaml|json] [output-file]
#
# Examples:
#   ./scripts/export-openapi.sh yaml openapi.yaml
#   ./scripts/export-openapi.sh json openapi.json
#   ./scripts/export-openapi.sh  # defaults to yaml, openapi.yaml

set -e

FORMAT="${1:-yaml}"
OUTPUT="${2:-openapi.$FORMAT}"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:$PORT"

if [[ "$FORMAT" != "yaml" && "$FORMAT" != "json" ]]; then
  echo "Error: Format must be 'yaml' or 'json'"
  echo "Usage: $0 [yaml|json] [output-file]"
  exit 1
fi

# Check if server is running
if ! curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
  echo "Error: Server is not running at $BASE_URL"
  echo "Please start the server with 'yarn dev' or 'yarn start'"
  exit 1
fi

echo "Fetching OpenAPI spec from $BASE_URL/docs/$FORMAT..."
curl -sf "$BASE_URL/docs/$FORMAT" > "$OUTPUT"

echo "OpenAPI specification exported to: $OUTPUT"
echo ""
echo "You can now:"
echo "  1. View the spec: cat $OUTPUT"
echo "  2. Generate clients using tools like openapi-generator"
echo "  3. Share with LLMs for client SDK generation"
echo "  4. Import into API testing tools (Postman, Insomnia, etc.)"
