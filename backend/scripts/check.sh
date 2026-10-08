#!/bin/sh
set -eu
formatting="$(gofmt -l cmd internal migrations seeds integration)"
if [ -n "$formatting" ]; then
  echo "Go formatting required:"
  echo "$formatting"
  exit 1
fi
go vet ./...
go test -count=1 ./...
