-- Agregar columnas de check-in GPS a la tabla de actividades
-- Ejecutar después de desplegar el código nuevo

ALTER TABLE crm.activities
ADD check_in_lat DECIMAL(9,6) NULL,
    check_in_lon DECIMAL(9,6) NULL;

-- Validar que las coordenadas estén en rango
ALTER TABLE crm.activities
ADD CONSTRAINT CK_activities_checkin_lat CHECK (check_in_lat IS NULL OR (check_in_lat >= -90 AND check_in_lat <= 90));

ALTER TABLE crm.activities
ADD CONSTRAINT CK_activities_checkin_lon CHECK (check_in_lon IS NULL OR (check_in_lon >= -180 AND check_in_lon <= 180));

-- Índice para consultas de check-ins por fecha
CREATE INDEX IX_activities_checkin ON crm.activities (company_id, status, check_in_lat, check_in_lon)
WHERE check_in_lat IS NOT NULL AND check_in_lon IS NOT NULL;
