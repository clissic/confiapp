# Pruebas del Endpoint Health

## Resumen
Se implementó el endpoint GET /health que:
- Retorna 200 OK cuando la base de datos está conectada
- Retorna 503 Service Unavailable cuando la base de datos no está disponible
- No requiere autenticación
- Responde rápidamente (~1ms)

## Caso 1: Base de datos desconectada

### Request
```bash
curl -i http://localhost:3333/health
```

### Response
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json; charset=utf-8
Content-Length: 76

{
  "status": "error",
  "uptime": 20,
  "database": {
    "connected": false,
    "readyState": 0
  }
}
```

## Caso 2: Base de datos conectada

### Request
```bash
curl -i http://localhost:3333/health
```

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 72

{
  "status": "ok",
  "uptime": 17,
  "database": {
    "connected": true,
    "readyState": 1
  }
}
```

## Estados de readyState
- 0: disconnected
- 1: connected
- 2: connecting
- 3: disconnecting

## Seguridad
El endpoint no expone:
- Variables de entorno
- Secretos
- Contraseñas
- Información sensible del servidor
- Detalles internos de configuración

Solo muestra:
- Estado general (ok/error)
- Uptime del proceso en segundos
- Estado de conexión de la base de datos (booleano y código numérico de estado)
