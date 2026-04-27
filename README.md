# Flash-Go-Delivery

## Deployment environment variables

Set these values before deploying:

- Frontend (`frontend/.env`):
  - `NEXT_PUBLIC_FRONTEND_URL=https://flash-go-delivery.up.railway.app`
  - `NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.example.com`
- Backend (`backend/.env`):
  - `FRONTEND_URL=https://flash-go-delivery.up.railway.app`
  - `BACKEND_URL=https://your-backend-domain.example.com`

`FRONTEND_ORIGIN`, `BACKEND_BASE_URL`, and `NEXT_PUBLIC_API_URL` are still accepted as fallback aliases for backward compatibility during migration.