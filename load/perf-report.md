# Load Test Report – 2025-12-10

## Command
```bash
JWT="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJPMzVacGVzeDg3UnJVbzgwMzJLV2IiLCJzdGVhbUlkIjoiNzY1NjExOTgxNjg2NDI1MjkiLCJwZXJzb25hTmFtZSI6IlVzZXItNjQyNTI5Iiwicm9sZXMiOlsidXNlciIsImFkbWluIl0sImlhdCI6MTc2NTQwOTI5MCwiZXhwIjoxNzY1NDEyODkwLCJpc3MiOiJhdXRoLXNlcnZpY2UifQ.zs9i6qDqwxO3myXj9GErgDsXjWTjSIK_WxmReVY6Rv8" \
BASE=https://steamviewdashboard.online \
VUS=30 \
DURATION=2m \
k6 run load/load-test.js
```

## Summary
| Metric | Value |
| --- | --- |
| Duration / VUs | 2m @ 30 VUs |
| Total requests | 5,656 (≈46.1 rps) |
| Error rate | **7.08%** (401s) |
| http_req_duration avg | 392 ms |
| http_req_duration p90 | 1.21 s |
| http_req_duration p95 | **1.27 s** |
| http_req_duration p99 | **1.38 s** |
| Min / Max latency | 8.64 ms / 1.83 s |
| Iterations | 1,414 (avg iteration 2.57 s) |
| Data received / sent | ~201 MB / 798 kB |

## Thresholds
- `http_req_duration`: p95<600 ms (failed), p99<900 ms (failed)
- `http_req_failed`: rate<1% (failed – 7.08%, mainly 401 responses)

