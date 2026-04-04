-- Agregar categorías de productos
CREATE TABLE crm.product_categories (
    category_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    category_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_product_categories_company FOREIGN KEY (company_id) REFERENCES crm.companies(company_id)
);

-- Agregar columna category_id a productos
ALTER TABLE crm.products
ADD category_id INT NULL
CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES crm.product_categories(category_id);

-- Tabla de historial de precios
CREATE TABLE crm.product_price_history (
    history_id INT IDENTITY(1,1) PRIMARY KEY,
    company_id INT NOT NULL,
    product_id INT NOT NULL,
    old_price DECIMAL(18,2) NOT NULL,
    new_price DECIMAL(18,2) NOT NULL,
    changed_by_user_id INT NULL,
    changed_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_price_history_company FOREIGN KEY (company_id) REFERENCES crm.companies(company_id),
    CONSTRAINT FK_price_history_product FOREIGN KEY (product_id) REFERENCES crm.products(product_id)
);

-- Índice para búsqueda de productos
CREATE INDEX IX_products_sku ON crm.products(company_id, sku);
CREATE INDEX IX_products_name ON crm.products(company_id, product_name);
CREATE INDEX IX_products_category ON crm.products(company_id, category_id);

-- Datos de ejemplo de categorías
INSERT INTO crm.product_categories (company_id, category_name, description)
VALUES 
    (1, 'General', 'Productos generales'),
    (1, 'Servicios', 'Servicios profesionales'),
    (1, 'Equipos', 'Equipos y maquinaria');
