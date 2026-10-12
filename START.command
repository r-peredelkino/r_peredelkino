#!/bin/bash
cd "$(dirname "$0")" || exit 1
/usr/bin/python3 -m http.server 8080 --directory dist --bind 127.0.0.1
