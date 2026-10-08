# VetData API (Go): golang:1.26-alpine compiles the binary with CGO
# disabled, then a slim alpine runtime image runs it as a non-root user.
# The container listens on :4000 (DATABASE_URL required at startup).
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget
RUN adduser -D -u 10001 app
WORKDIR /app
COPY --from=builder /out/api /usr/local/bin/api
USER app
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/api"]
