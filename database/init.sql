-- Sample database schema for Text-to-SQL testing
-- This creates sample tables with realistic business data

-- Create customers table
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table (many-to-many between orders and products)
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample customers
INSERT INTO customers (name, email, phone, address, city, state) VALUES
('John Smith', 'john.smith@email.com', '555-1234', '123 Main St', 'New York', 'NY'),
('Sarah Johnson', 'sarah.j@email.com', '555-5678', '456 Oak Ave', 'Los Angeles', 'CA'),
('Mike Davis', 'mike.davis@email.com', '555-9012', '789 Pine St', 'Chicago', 'IL'),
('Emily Brown', 'emily.b@email.com', '555-3456', '321 Elm St', 'Houston', 'TX'),
('David Wilson', 'david.w@email.com', '555-7890', '654 Maple Dr', 'Phoenix', 'AZ'),
('Lisa Garcia', 'lisa.garcia@email.com', '555-2468', '987 Cedar Ln', 'Philadelphia', 'PA'),
('Robert Miller', 'robert.m@email.com', '555-1357', '147 Birch Rd', 'San Antonio', 'TX'),
('Jennifer Lee', 'jennifer.lee@email.com', '555-8642', '258 Spruce St', 'San Diego', 'CA');

-- Insert sample products
INSERT INTO products (name, description, price, category, stock_quantity) VALUES
('Laptop Pro 15"', 'High-performance laptop with 16GB RAM', 1299.99, 'Electronics', 50),
('Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 29.99, 'Electronics', 200),
('Office Chair', 'Comfortable ergonomic office chair', 199.99, 'Furniture', 25),
('Coffee Maker', 'Programmable 12-cup coffee maker', 89.99, 'Appliances', 30),
('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 'Furniture', 75),
('Smartphone Case', 'Protective case for latest smartphone models', 19.99, 'Accessories', 150),
('Bluetooth Headphones', 'Noise-canceling wireless headphones', 159.99, 'Electronics', 40),
('Standing Desk', 'Adjustable height standing desk', 349.99, 'Furniture', 15),
('Tablet 10"', 'Lightweight tablet with 64GB storage', 299.99, 'Electronics', 60),
('Keyboard Mechanical', 'RGB backlit mechanical keyboard', 79.99, 'Electronics', 80);

-- Insert sample orders
INSERT INTO orders (customer_id, order_date, status, total_amount, shipping_address) VALUES
(1, '2024-01-15 10:30:00', 'completed', 1329.98, '123 Main St, New York, NY'),
(2, '2024-01-16 14:45:00', 'completed', 249.98, '456 Oak Ave, Los Angeles, CA'),
(3, '2024-01-17 09:15:00', 'shipped', 89.99, '789 Pine St, Chicago, IL'),
(4, '2024-01-18 16:20:00', 'completed', 519.97, '321 Elm St, Houston, TX'),
(1, '2024-01-19 11:00:00', 'processing', 159.99, '123 Main St, New York, NY'),
(5, '2024-01-20 13:30:00', 'completed', 379.98, '654 Maple Dr, Phoenix, AZ'),
(6, '2024-01-21 08:45:00', 'shipped', 199.99, '987 Cedar Ln, Philadelphia, PA'),
(2, '2024-01-22 15:10:00', 'completed', 109.98, '456 Oak Ave, Los Angeles, CA');

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
-- Order 1: Laptop + Mouse
(1, 1, 1, 1299.99, 1299.99),
(1, 2, 1, 29.99, 29.99),
-- Order 2: Office Chair + Desk Lamp
(2, 3, 1, 199.99, 199.99),
(2, 5, 1, 39.99, 39.99),
-- Order 3: Coffee Maker
(3, 4, 1, 89.99, 89.99),
-- Order 4: Standing Desk + Headphones + Smartphone Case
(4, 8, 1, 349.99, 349.99),
(4, 7, 1, 159.99, 159.99),
(4, 6, 1, 19.99, 19.99),
-- Order 5: Headphones
(5, 7, 1, 159.99, 159.99),
-- Order 6: Tablet + Keyboard
(6, 9, 1, 299.99, 299.99),
(6, 10, 1, 79.99, 79.99),
-- Order 7: Office Chair
(7, 3, 1, 199.99, 199.99),
-- Order 8: Desk Lamp + Mouse + Smartphone Case
(8, 5, 1, 39.99, 39.99),
(8, 2, 1, 29.99, 29.99),
(8, 6, 2, 19.99, 39.98);

-- Create indexes for better query performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_category ON products(category);

-- Add some comments to tables for better schema understanding
COMMENT ON TABLE customers IS 'Customer information and contact details';
COMMENT ON TABLE products IS 'Product catalog with pricing and inventory';
COMMENT ON TABLE orders IS 'Customer orders with status and totals';
COMMENT ON TABLE order_items IS 'Individual items within each order';

COMMENT ON COLUMN customers.created_at IS 'When the customer account was created';
COMMENT ON COLUMN orders.status IS 'Order status: pending, processing, shipped, completed, cancelled';
COMMENT ON COLUMN products.stock_quantity IS 'Current inventory level for this product'; 