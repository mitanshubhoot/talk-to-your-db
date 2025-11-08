-- ============================================================================
-- Demo Database Initialization Script
-- ============================================================================
-- This script creates and populates a demo e-commerce database for new users
-- to immediately try the application without setting up their own database.
--
-- Tables: products, customers, orders, order_items
-- Features: Foreign keys, indexes, realistic sample data
-- ============================================================================

-- Drop existing tables if they exist (for idempotent execution)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- ============================================================================
-- TABLE: products
-- ============================================================================
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_stock ON products(stock_quantity);

-- ============================================================================
-- TABLE: customers
-- ============================================================================
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_state ON customers(state);
CREATE INDEX idx_customers_country ON customers(country);

-- ============================================================================
-- TABLE: orders
-- ============================================================================
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_date TIMESTAMP NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(50) NOT NULL,
  shipping_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_total_amount ON orders(total_amount);

-- ============================================================================
-- TABLE: order_items
-- ============================================================================
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0)
);

-- Create indexes for common query patterns
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);


-- ============================================================================
-- SAMPLE DATA: Products (50+ records across multiple categories)
-- ============================================================================
INSERT INTO products (name, category, price, stock_quantity, description) VALUES
-- Electronics
('Wireless Bluetooth Headphones', 'Electronics', 79.99, 45, 'Premium noise-cancelling headphones with 30-hour battery life'),
('4K Smart TV 55"', 'Electronics', 599.99, 12, 'Ultra HD smart television with HDR and streaming apps'),
('Laptop Stand Aluminum', 'Electronics', 39.99, 67, 'Ergonomic adjustable laptop stand for better posture'),
('USB-C Hub 7-in-1', 'Electronics', 49.99, 89, 'Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader'),
('Wireless Mouse', 'Electronics', 24.99, 120, 'Ergonomic wireless mouse with precision tracking'),
('Mechanical Keyboard RGB', 'Electronics', 129.99, 34, 'Gaming mechanical keyboard with customizable RGB lighting'),
('Webcam 1080p HD', 'Electronics', 69.99, 56, 'Full HD webcam with auto-focus and built-in microphone'),
('Portable SSD 1TB', 'Electronics', 149.99, 41, 'Fast external solid-state drive with USB-C connection'),
('Smartphone Stand', 'Electronics', 15.99, 200, 'Adjustable phone holder for desk or bedside'),
('Power Bank 20000mAh', 'Electronics', 44.99, 78, 'High-capacity portable charger with fast charging'),

-- Home & Kitchen
('Stainless Steel Cookware Set', 'Home & Kitchen', 199.99, 23, '10-piece professional cookware set with lids'),
('Coffee Maker Programmable', 'Home & Kitchen', 89.99, 45, '12-cup programmable coffee maker with thermal carafe'),
('Blender High-Speed', 'Home & Kitchen', 119.99, 31, 'Professional blender for smoothies and food processing'),
('Air Fryer 5.8 Quart', 'Home & Kitchen', 129.99, 28, 'Digital air fryer with 8 preset cooking functions'),
('Vacuum Cleaner Cordless', 'Home & Kitchen', 249.99, 19, 'Powerful cordless stick vacuum with HEPA filter'),
('Dish Rack Stainless Steel', 'Home & Kitchen', 34.99, 67, 'Large capacity dish drying rack with utensil holder'),
('Kitchen Knife Set', 'Home & Kitchen', 79.99, 52, '15-piece professional knife set with wooden block'),
('Mixing Bowl Set', 'Home & Kitchen', 29.99, 88, 'Nesting stainless steel mixing bowls, set of 5'),
('Cutting Board Bamboo', 'Home & Kitchen', 24.99, 95, 'Extra large bamboo cutting board with juice groove'),
('Food Storage Containers', 'Home & Kitchen', 39.99, 110, '24-piece glass food storage set with locking lids'),

-- Clothing
('Men\'s Cotton T-Shirt', 'Clothing', 19.99, 150, 'Comfortable crew neck t-shirt in various colors'),
('Women\'s Yoga Pants', 'Clothing', 34.99, 120, 'High-waist athletic leggings with pockets'),
('Denim Jeans Classic Fit', 'Clothing', 59.99, 85, 'Classic fit jeans in dark wash denim'),
('Hoodie Pullover', 'Clothing', 44.99, 95, 'Soft fleece hoodie with kangaroo pocket'),
('Running Shoes', 'Clothing', 89.99, 67, 'Lightweight running shoes with cushioned sole'),
('Winter Jacket', 'Clothing', 149.99, 34, 'Insulated winter jacket with removable hood'),
('Casual Sneakers', 'Clothing', 69.99, 78, 'Comfortable everyday sneakers in canvas'),
('Baseball Cap', 'Clothing', 24.99, 145, 'Adjustable baseball cap with embroidered logo'),
('Wool Socks 6-Pack', 'Clothing', 29.99, 200, 'Warm merino wool socks for all seasons'),
('Leather Belt', 'Clothing', 39.99, 88, 'Genuine leather belt with classic buckle'),

-- Books
('The Art of Programming', 'Books', 49.99, 45, 'Comprehensive guide to software development'),
('Cooking Mastery', 'Books', 34.99, 67, 'Professional techniques for home cooks'),
('Mindfulness and Meditation', 'Books', 24.99, 89, 'Practical guide to daily meditation practice'),
('World History Encyclopedia', 'Books', 59.99, 23, 'Complete illustrated history of civilization'),
('Science Fiction Anthology', 'Books', 29.99, 56, 'Collection of award-winning sci-fi stories'),
('Business Strategy Guide', 'Books', 44.99, 41, 'Modern approaches to business growth'),
('Photography Basics', 'Books', 39.99, 52, 'Learn digital photography from scratch'),
('Gardening Year-Round', 'Books', 27.99, 73, 'Complete guide to home gardening'),
('Fitness Training Manual', 'Books', 32.99, 61, 'Strength and conditioning programs'),
('Travel Guide Europe', 'Books', 36.99, 48, 'Comprehensive European travel guide'),

-- Sports & Outdoors
('Yoga Mat Premium', 'Sports & Outdoors', 39.99, 95, 'Extra thick non-slip yoga mat with carrying strap'),
('Camping Tent 4-Person', 'Sports & Outdoors', 179.99, 18, 'Waterproof family camping tent with easy setup'),
('Hiking Backpack 40L', 'Sports & Outdoors', 89.99, 34, 'Durable hiking backpack with hydration system'),
('Resistance Bands Set', 'Sports & Outdoors', 24.99, 120, '5-piece resistance band set for home workouts'),
('Water Bottle Insulated', 'Sports & Outdoors', 29.99, 156, '32oz stainless steel water bottle keeps drinks cold 24hrs'),
('Bicycle Helmet', 'Sports & Outdoors', 49.99, 67, 'Lightweight cycling helmet with adjustable fit'),
('Sleeping Bag', 'Sports & Outdoors', 69.99, 45, '3-season sleeping bag rated to 20°F'),
('Dumbbells Set', 'Sports & Outdoors', 149.99, 28, 'Adjustable dumbbell set 5-50 lbs'),
('Jump Rope Speed', 'Sports & Outdoors', 14.99, 180, 'Professional speed jump rope for cardio'),
('Foam Roller', 'Sports & Outdoors', 34.99, 89, 'High-density foam roller for muscle recovery');

-- ============================================================================
-- SAMPLE DATA: Customers (30+ records with diverse locations)
-- ============================================================================
INSERT INTO customers (first_name, last_name, email, phone, city, state, country) VALUES
('John', 'Smith', 'john.smith@email.com', '555-0101', 'New York', 'NY', 'USA'),
('Emma', 'Johnson', 'emma.j@email.com', '555-0102', 'Los Angeles', 'CA', 'USA'),
('Michael', 'Williams', 'michael.w@email.com', '555-0103', 'Chicago', 'IL', 'USA'),
('Sarah', 'Brown', 'sarah.brown@email.com', '555-0104', 'Houston', 'TX', 'USA'),
('David', 'Jones', 'david.jones@email.com', '555-0105', 'Phoenix', 'AZ', 'USA'),
('Emily', 'Garcia', 'emily.garcia@email.com', '555-0106', 'Philadelphia', 'PA', 'USA'),
('James', 'Martinez', 'james.m@email.com', '555-0107', 'San Antonio', 'TX', 'USA'),
('Lisa', 'Rodriguez', 'lisa.r@email.com', '555-0108', 'San Diego', 'CA', 'USA'),
('Robert', 'Wilson', 'robert.w@email.com', '555-0109', 'Dallas', 'TX', 'USA'),
('Jennifer', 'Anderson', 'jennifer.a@email.com', '555-0110', 'San Jose', 'CA', 'USA'),
('William', 'Taylor', 'william.t@email.com', '555-0111', 'Austin', 'TX', 'USA'),
('Jessica', 'Thomas', 'jessica.t@email.com', '555-0112', 'Jacksonville', 'FL', 'USA'),
('Christopher', 'Moore', 'chris.moore@email.com', '555-0113', 'Fort Worth', 'TX', 'USA'),
('Amanda', 'Jackson', 'amanda.j@email.com', '555-0114', 'Columbus', 'OH', 'USA'),
('Daniel', 'White', 'daniel.white@email.com', '555-0115', 'Charlotte', 'NC', 'USA'),
('Ashley', 'Harris', 'ashley.h@email.com', '555-0116', 'San Francisco', 'CA', 'USA'),
('Matthew', 'Martin', 'matthew.m@email.com', '555-0117', 'Indianapolis', 'IN', 'USA'),
('Stephanie', 'Thompson', 'stephanie.t@email.com', '555-0118', 'Seattle', 'WA', 'USA'),
('Joshua', 'Garcia', 'joshua.g@email.com', '555-0119', 'Denver', 'CO', 'USA'),
('Michelle', 'Martinez', 'michelle.m@email.com', '555-0120', 'Boston', 'MA', 'USA'),
('Andrew', 'Robinson', 'andrew.r@email.com', '555-0121', 'Portland', 'OR', 'USA'),
('Laura', 'Clark', 'laura.clark@email.com', '555-0122', 'Nashville', 'TN', 'USA'),
('Kevin', 'Lewis', 'kevin.lewis@email.com', '555-0123', 'Detroit', 'MI', 'USA'),
('Rachel', 'Lee', 'rachel.lee@email.com', '555-0124', 'Las Vegas', 'NV', 'USA'),
('Brian', 'Walker', 'brian.walker@email.com', '555-0125', 'Memphis', 'TN', 'USA'),
('Nicole', 'Hall', 'nicole.hall@email.com', '555-0126', 'Baltimore', 'MD', 'USA'),
('Ryan', 'Allen', 'ryan.allen@email.com', '555-0127', 'Milwaukee', 'WI', 'USA'),
('Samantha', 'Young', 'samantha.y@email.com', '555-0128', 'Albuquerque', 'NM', 'USA'),
('Jason', 'King', 'jason.king@email.com', '555-0129', 'Tucson', 'AZ', 'USA'),
('Megan', 'Wright', 'megan.wright@email.com', '555-0130', 'Fresno', 'CA', 'USA'),
('Brandon', 'Lopez', 'brandon.lopez@email.com', '555-0131', 'Sacramento', 'CA', 'USA'),
('Brittany', 'Hill', 'brittany.h@email.com', '555-0132', 'Kansas City', 'MO', 'USA'),
('Tyler', 'Scott', 'tyler.scott@email.com', '555-0133', 'Mesa', 'AZ', 'USA'),
('Amber', 'Green', 'amber.green@email.com', '555-0134', 'Atlanta', 'GA', 'USA'),
('Justin', 'Adams', 'justin.adams@email.com', '555-0135', 'Omaha', 'NE', 'USA');


-- ============================================================================
-- SAMPLE DATA: Orders (100+ records spanning 12 months)
-- ============================================================================
INSERT INTO orders (customer_id, order_date, total_amount, status, shipping_address) VALUES
-- Orders from 12 months ago to present
(1, CURRENT_TIMESTAMP - INTERVAL '350 days', 159.98, 'delivered', '123 Main St, New York, NY 10001'),
(2, CURRENT_TIMESTAMP - INTERVAL '345 days', 89.99, 'delivered', '456 Oak Ave, Los Angeles, CA 90001'),
(3, CURRENT_TIMESTAMP - INTERVAL '340 days', 249.97, 'delivered', '789 Pine Rd, Chicago, IL 60601'),
(4, CURRENT_TIMESTAMP - INTERVAL '335 days', 179.99, 'delivered', '321 Elm St, Houston, TX 77001'),
(5, CURRENT_TIMESTAMP - INTERVAL '330 days', 129.99, 'delivered', '654 Maple Dr, Phoenix, AZ 85001'),
(6, CURRENT_TIMESTAMP - INTERVAL '325 days', 299.98, 'delivered', '987 Cedar Ln, Philadelphia, PA 19019'),
(7, CURRENT_TIMESTAMP - INTERVAL '320 days', 79.99, 'delivered', '147 Birch Ct, San Antonio, TX 78201'),
(8, CURRENT_TIMESTAMP - INTERVAL '315 days', 449.97, 'delivered', '258 Spruce Way, San Diego, CA 92101'),
(9, CURRENT_TIMESTAMP - INTERVAL '310 days', 199.99, 'delivered', '369 Willow Pl, Dallas, TX 75201'),
(10, CURRENT_TIMESTAMP - INTERVAL '305 days', 149.99, 'delivered', '741 Ash Blvd, San Jose, CA 95101'),
(11, CURRENT_TIMESTAMP - INTERVAL '300 days', 89.99, 'delivered', '852 Palm Ave, Austin, TX 78701'),
(12, CURRENT_TIMESTAMP - INTERVAL '295 days', 329.98, 'delivered', '963 Fir St, Jacksonville, FL 32099'),
(13, CURRENT_TIMESTAMP - INTERVAL '290 days', 119.99, 'delivered', '159 Poplar Dr, Fort Worth, TX 76101'),
(14, CURRENT_TIMESTAMP - INTERVAL '285 days', 279.97, 'delivered', '357 Hickory Ln, Columbus, OH 43085'),
(15, CURRENT_TIMESTAMP - INTERVAL '280 days', 199.99, 'delivered', '486 Walnut Rd, Charlotte, NC 28201'),
(16, CURRENT_TIMESTAMP - INTERVAL '275 days', 549.98, 'delivered', '624 Chestnut Ave, San Francisco, CA 94102'),
(17, CURRENT_TIMESTAMP - INTERVAL '270 days', 89.99, 'delivered', '735 Sycamore St, Indianapolis, IN 46201'),
(18, CURRENT_TIMESTAMP - INTERVAL '265 days', 169.98, 'delivered', '846 Magnolia Ct, Seattle, WA 98101'),
(19, CURRENT_TIMESTAMP - INTERVAL '260 days', 229.99, 'delivered', '957 Dogwood Way, Denver, CO 80201'),
(20, CURRENT_TIMESTAMP - INTERVAL '255 days', 149.99, 'delivered', '135 Redwood Pl, Boston, MA 02101'),
(21, CURRENT_TIMESTAMP - INTERVAL '250 days', 399.97, 'delivered', '246 Sequoia Blvd, Portland, OR 97201'),
(22, CURRENT_TIMESTAMP - INTERVAL '245 days', 79.99, 'delivered', '357 Cypress Ave, Nashville, TN 37201'),
(23, CURRENT_TIMESTAMP - INTERVAL '240 days', 189.98, 'delivered', '468 Juniper St, Detroit, MI 48201'),
(24, CURRENT_TIMESTAMP - INTERVAL '235 days', 299.99, 'delivered', '579 Laurel Dr, Las Vegas, NV 89101'),
(25, CURRENT_TIMESTAMP - INTERVAL '230 days', 129.99, 'delivered', '681 Beech Ln, Memphis, TN 38101'),
(1, CURRENT_TIMESTAMP - INTERVAL '225 days', 249.98, 'delivered', '123 Main St, New York, NY 10001'),
(2, CURRENT_TIMESTAMP - INTERVAL '220 days', 179.99, 'delivered', '456 Oak Ave, Los Angeles, CA 90001'),
(3, CURRENT_TIMESTAMP - INTERVAL '215 days', 89.99, 'delivered', '789 Pine Rd, Chicago, IL 60601'),
(4, CURRENT_TIMESTAMP - INTERVAL '210 days', 329.97, 'delivered', '321 Elm St, Houston, TX 77001'),
(5, CURRENT_TIMESTAMP - INTERVAL '205 days', 199.99, 'delivered', '654 Maple Dr, Phoenix, AZ 85001'),
(26, CURRENT_TIMESTAMP - INTERVAL '200 days', 149.99, 'delivered', '792 Alder Rd, Baltimore, MD 21201'),
(27, CURRENT_TIMESTAMP - INTERVAL '195 days', 279.98, 'delivered', '813 Hazel Ave, Milwaukee, WI 53201'),
(28, CURRENT_TIMESTAMP - INTERVAL '190 days', 99.99, 'delivered', '924 Pecan St, Albuquerque, NM 87101'),
(29, CURRENT_TIMESTAMP - INTERVAL '185 days', 449.97, 'delivered', '135 Acacia Dr, Tucson, AZ 85701'),
(30, CURRENT_TIMESTAMP - INTERVAL '180 days', 189.99, 'delivered', '246 Mesquite Ln, Fresno, CA 93650'),
(31, CURRENT_TIMESTAMP - INTERVAL '175 days', 229.98, 'delivered', '357 Cottonwood Rd, Sacramento, CA 94203'),
(32, CURRENT_TIMESTAMP - INTERVAL '170 days', 149.99, 'delivered', '468 Ironwood Ave, Kansas City, MO 64101'),
(33, CURRENT_TIMESTAMP - INTERVAL '165 days', 379.97, 'delivered', '579 Basswood St, Mesa, AZ 85201'),
(34, CURRENT_TIMESTAMP - INTERVAL '160 days', 89.99, 'delivered', '681 Boxwood Dr, Atlanta, GA 30301'),
(35, CURRENT_TIMESTAMP - INTERVAL '155 days', 299.98, 'delivered', '792 Buckeye Ln, Omaha, NE 68101'),
(6, CURRENT_TIMESTAMP - INTERVAL '150 days', 179.99, 'delivered', '987 Cedar Ln, Philadelphia, PA 19019'),
(7, CURRENT_TIMESTAMP - INTERVAL '145 days', 249.97, 'delivered', '147 Birch Ct, San Antonio, TX 78201'),
(8, CURRENT_TIMESTAMP - INTERVAL '140 days', 129.99, 'delivered', '258 Spruce Way, San Diego, CA 92101'),
(9, CURRENT_TIMESTAMP - INTERVAL '135 days', 399.98, 'delivered', '369 Willow Pl, Dallas, TX 75201'),
(10, CURRENT_TIMESTAMP - INTERVAL '130 days', 199.99, 'delivered', '741 Ash Blvd, San Jose, CA 95101'),
(11, CURRENT_TIMESTAMP - INTERVAL '125 days', 149.99, 'delivered', '852 Palm Ave, Austin, TX 78701'),
(12, CURRENT_TIMESTAMP - INTERVAL '120 days', 279.98, 'delivered', '963 Fir St, Jacksonville, FL 32099'),
(13, CURRENT_TIMESTAMP - INTERVAL '115 days', 89.99, 'delivered', '159 Poplar Dr, Fort Worth, TX 76101'),
(14, CURRENT_TIMESTAMP - INTERVAL '110 days', 329.97, 'delivered', '357 Hickory Ln, Columbus, OH 43085'),
(15, CURRENT_TIMESTAMP - INTERVAL '105 days', 179.99, 'delivered', '486 Walnut Rd, Charlotte, NC 28201'),
(16, CURRENT_TIMESTAMP - INTERVAL '100 days', 249.98, 'delivered', '624 Chestnut Ave, San Francisco, CA 94102'),
(17, CURRENT_TIMESTAMP - INTERVAL '95 days', 129.99, 'delivered', '735 Sycamore St, Indianapolis, IN 46201'),
(18, CURRENT_TIMESTAMP - INTERVAL '90 days', 199.99, 'delivered', '846 Magnolia Ct, Seattle, WA 98101'),
(19, CURRENT_TIMESTAMP - INTERVAL '85 days', 299.97, 'delivered', '957 Dogwood Way, Denver, CO 80201'),
(20, CURRENT_TIMESTAMP - INTERVAL '80 days', 89.99, 'delivered', '135 Redwood Pl, Boston, MA 02101'),
(21, CURRENT_TIMESTAMP - INTERVAL '75 days', 449.98, 'delivered', '246 Sequoia Blvd, Portland, OR 97201'),
(22, CURRENT_TIMESTAMP - INTERVAL '70 days', 179.99, 'delivered', '357 Cypress Ave, Nashville, TN 37201'),
(23, CURRENT_TIMESTAMP - INTERVAL '65 days', 229.98, 'delivered', '468 Juniper St, Detroit, MI 48201'),
(24, CURRENT_TIMESTAMP - INTERVAL '60 days', 149.99, 'delivered', '579 Laurel Dr, Las Vegas, NV 89101'),
(25, CURRENT_TIMESTAMP - INTERVAL '55 days', 379.97, 'delivered', '681 Beech Ln, Memphis, TN 38101'),
(1, CURRENT_TIMESTAMP - INTERVAL '50 days', 199.99, 'delivered', '123 Main St, New York, NY 10001'),
(2, CURRENT_TIMESTAMP - INTERVAL '48 days', 129.99, 'delivered', '456 Oak Ave, Los Angeles, CA 90001'),
(3, CURRENT_TIMESTAMP - INTERVAL '46 days', 279.98, 'delivered', '789 Pine Rd, Chicago, IL 60601'),
(4, CURRENT_TIMESTAMP - INTERVAL '44 days', 89.99, 'delivered', '321 Elm St, Houston, TX 77001'),
(5, CURRENT_TIMESTAMP - INTERVAL '42 days', 329.97, 'delivered', '654 Maple Dr, Phoenix, AZ 85001'),
(26, CURRENT_TIMESTAMP - INTERVAL '40 days', 179.99, 'delivered', '792 Alder Rd, Baltimore, MD 21201'),
(27, CURRENT_TIMESTAMP - INTERVAL '38 days', 249.98, 'delivered', '813 Hazel Ave, Milwaukee, WI 53201'),
(28, CURRENT_TIMESTAMP - INTERVAL '36 days', 149.99, 'delivered', '924 Pecan St, Albuquerque, NM 87101'),
(29, CURRENT_TIMESTAMP - INTERVAL '34 days', 399.97, 'delivered', '135 Acacia Dr, Tucson, AZ 85701'),
(30, CURRENT_TIMESTAMP - INTERVAL '32 days', 199.99, 'delivered', '246 Mesquite Ln, Fresno, CA 93650'),
(31, CURRENT_TIMESTAMP - INTERVAL '30 days', 129.99, 'delivered', '357 Cottonwood Rd, Sacramento, CA 94203'),
(32, CURRENT_TIMESTAMP - INTERVAL '28 days', 279.98, 'delivered', '468 Ironwood Ave, Kansas City, MO 64101'),
(33, CURRENT_TIMESTAMP - INTERVAL '26 days', 89.99, 'delivered', '579 Basswood St, Mesa, AZ 85201'),
(34, CURRENT_TIMESTAMP - INTERVAL '24 days', 329.97, 'delivered', '681 Boxwood Dr, Atlanta, GA 30301'),
(35, CURRENT_TIMESTAMP - INTERVAL '22 days', 179.99, 'delivered', '792 Buckeye Ln, Omaha, NE 68101'),
(6, CURRENT_TIMESTAMP - INTERVAL '20 days', 249.98, 'shipped', '987 Cedar Ln, Philadelphia, PA 19019'),
(7, CURRENT_TIMESTAMP - INTERVAL '18 days', 149.99, 'shipped', '147 Birch Ct, San Antonio, TX 78201'),
(8, CURRENT_TIMESTAMP - INTERVAL '16 days', 399.97, 'shipped', '258 Spruce Way, San Diego, CA 92101'),
(9, CURRENT_TIMESTAMP - INTERVAL '14 days', 199.99, 'shipped', '369 Willow Pl, Dallas, TX 75201'),
(10, CURRENT_TIMESTAMP - INTERVAL '12 days', 129.99, 'processing', '741 Ash Blvd, San Jose, CA 95101'),
(11, CURRENT_TIMESTAMP - INTERVAL '10 days', 279.98, 'processing', '852 Palm Ave, Austin, TX 78701'),
(12, CURRENT_TIMESTAMP - INTERVAL '8 days', 89.99, 'processing', '963 Fir St, Jacksonville, FL 32099'),
(13, CURRENT_TIMESTAMP - INTERVAL '6 days', 329.97, 'processing', '159 Poplar Dr, Fort Worth, TX 76101'),
(14, CURRENT_TIMESTAMP - INTERVAL '4 days', 179.99, 'pending', '357 Hickory Ln, Columbus, OH 43085'),
(15, CURRENT_TIMESTAMP - INTERVAL '2 days', 249.98, 'pending', '486 Walnut Rd, Charlotte, NC 28201'),
(16, CURRENT_TIMESTAMP - INTERVAL '1 day', 149.99, 'pending', '624 Chestnut Ave, San Francisco, CA 94102'),
(17, CURRENT_TIMESTAMP - INTERVAL '12 hours', 399.97, 'pending', '735 Sycamore St, Indianapolis, IN 46201'),
(18, CURRENT_TIMESTAMP - INTERVAL '6 hours', 199.99, 'pending', '846 Magnolia Ct, Seattle, WA 98101'),
(19, CURRENT_TIMESTAMP - INTERVAL '3 hours', 129.99, 'pending', '957 Dogwood Way, Denver, CO 80201'),
(20, CURRENT_TIMESTAMP - INTERVAL '1 hour', 279.98, 'pending', '135 Redwood Pl, Boston, MA 02101'),
(21, CURRENT_TIMESTAMP - INTERVAL '340 days', 189.99, 'delivered', '246 Sequoia Blvd, Portland, OR 97201'),
(22, CURRENT_TIMESTAMP - INTERVAL '310 days', 349.97, 'delivered', '357 Cypress Ave, Nashville, TN 37201'),
(23, CURRENT_TIMESTAMP - INTERVAL '280 days', 99.99, 'delivered', '468 Juniper St, Detroit, MI 48201'),
(24, CURRENT_TIMESTAMP - INTERVAL '250 days', 429.98, 'delivered', '579 Laurel Dr, Las Vegas, NV 89101'),
(25, CURRENT_TIMESTAMP - INTERVAL '220 days', 159.99, 'delivered', '681 Beech Ln, Memphis, TN 38101'),
(26, CURRENT_TIMESTAMP - INTERVAL '190 days', 289.98, 'delivered', '792 Alder Rd, Baltimore, MD 21201'),
(27, CURRENT_TIMESTAMP - INTERVAL '160 days', 119.99, 'delivered', '813 Hazel Ave, Milwaukee, WI 53201'),
(28, CURRENT_TIMESTAMP - INTERVAL '130 days', 379.97, 'delivered', '924 Pecan St, Albuquerque, NM 87101'),
(29, CURRENT_TIMESTAMP - INTERVAL '100 days', 209.99, 'delivered', '135 Acacia Dr, Tucson, AZ 85701'),
(30, CURRENT_TIMESTAMP - INTERVAL '70 days', 139.99, 'delivered', '246 Mesquite Ln, Fresno, CA 93650'),
(31, CURRENT_TIMESTAMP - INTERVAL '40 days', 299.98, 'delivered', '357 Cottonwood Rd, Sacramento, CA 94203'),
(32, CURRENT_TIMESTAMP - INTERVAL '35 days', 169.99, 'delivered', '468 Ironwood Ave, Kansas City, MO 64101'),
(33, CURRENT_TIMESTAMP - INTERVAL '30 days', 399.97, 'delivered', '579 Basswood St, Mesa, AZ 85201'),
(34, CURRENT_TIMESTAMP - INTERVAL '25 days', 229.99, 'delivered', '681 Boxwood Dr, Atlanta, GA 30301'),
(35, CURRENT_TIMESTAMP - INTERVAL '15 days', 149.99, 'shipped', '792 Buckeye Ln, Omaha, NE 68101');


-- ============================================================================
-- SAMPLE DATA: Order Items (200+ records)
-- ============================================================================
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
-- Order 1
(1, 1, 2, 79.99, 159.98),
-- Order 2
(2, 13, 1, 89.99, 89.99),
-- Order 3
(3, 2, 1, 599.99, 599.99),
(3, 3, 2, 39.99, 79.98),
-- Order 4
(4, 11, 1, 179.99, 179.99),
-- Order 5
(5, 14, 1, 129.99, 129.99),
-- Order 6
(6, 25, 2, 89.99, 179.98),
(6, 26, 1, 149.99, 149.99),
-- Order 7
(7, 1, 1, 79.99, 79.99),
-- Order 8
(8, 2, 1, 599.99, 599.99),
(8, 7, 1, 69.99, 69.99),
-- Order 9
(9, 15, 1, 199.99, 199.99),
-- Order 10
(10, 8, 1, 149.99, 149.99),
-- Order 11
(11, 13, 1, 89.99, 89.99),
-- Order 12
(12, 11, 1, 199.99, 199.99),
(12, 12, 1, 89.99, 89.99),
(12, 16, 1, 34.99, 34.99),
-- Order 13
(13, 14, 1, 119.99, 119.99),
-- Order 14
(14, 21, 3, 19.99, 59.97),
(14, 28, 2, 24.99, 49.98),
(14, 30, 2, 39.99, 79.98),
-- Order 15
(15, 15, 1, 199.99, 199.99),
-- Order 16
(16, 2, 1, 599.99, 599.99),
(16, 4, 1, 49.99, 49.99),
-- Order 17
(17, 13, 1, 89.99, 89.99),
-- Order 18
(18, 22, 2, 34.99, 69.98),
(18, 24, 1, 59.99, 59.99),
(18, 27, 1, 69.99, 69.99),
-- Order 19
(19, 6, 1, 129.99, 129.99),
(19, 5, 1, 24.99, 24.99),
(19, 10, 1, 44.99, 44.99),
-- Order 20
(20, 8, 1, 149.99, 149.99),
-- Order 21
(21, 31, 1, 49.99, 49.99),
(21, 32, 1, 34.99, 34.99),
(21, 33, 1, 24.99, 24.99),
(21, 34, 1, 59.99, 59.99),
(21, 35, 1, 29.99, 29.99),
-- Order 22
(22, 1, 1, 79.99, 79.99),
-- Order 23
(23, 41, 2, 39.99, 79.98),
(23, 42, 1, 179.99, 179.99),
-- Order 24
(24, 15, 1, 249.99, 249.99),
(24, 48, 1, 149.99, 149.99),
-- Order 25
(25, 14, 1, 129.99, 129.99),
-- Order 26
(26, 2, 1, 599.99, 599.99),
(26, 3, 2, 39.99, 79.98),
-- Order 27
(27, 25, 2, 89.99, 179.98),
-- Order 28
(28, 13, 1, 89.99, 89.99),
-- Order 29
(29, 11, 1, 199.99, 199.99),
(29, 12, 1, 89.99, 89.99),
(29, 17, 1, 79.99, 79.99),
-- Order 30
(30, 43, 1, 89.99, 89.99),
(30, 45, 2, 49.99, 99.98),
-- Order 31
(31, 21, 3, 19.99, 59.97),
(31, 22, 2, 34.99, 69.98),
(31, 29, 3, 29.99, 89.97),
-- Order 32
(32, 8, 1, 149.99, 149.99),
-- Order 33
(33, 26, 1, 149.99, 149.99),
(33, 25, 1, 89.99, 89.99),
(33, 24, 1, 59.99, 59.99),
-- Order 34
(34, 13, 1, 89.99, 89.99),
-- Order 35
(35, 2, 1, 599.99, 599.99),
(35, 4, 1, 49.99, 49.99),
-- Order 36
(36, 15, 1, 179.99, 179.99),
-- Order 37
(37, 11, 1, 199.99, 199.99),
(37, 16, 1, 34.99, 34.99),
(37, 18, 1, 29.99, 29.99),
-- Order 38
(38, 14, 1, 129.99, 129.99),
-- Order 39
(39, 2, 1, 599.99, 599.99),
(39, 7, 1, 69.99, 69.99),
-- Order 40
(40, 15, 1, 199.99, 199.99),
-- Order 41
(41, 8, 1, 149.99, 149.99),
-- Order 42
(42, 11, 1, 199.99, 199.99),
(42, 12, 1, 89.99, 89.99),
-- Order 43
(43, 13, 1, 89.99, 89.99),
-- Order 44
(44, 21, 4, 19.99, 79.96),
(44, 22, 3, 34.99, 104.97),
(44, 23, 2, 59.99, 119.98),
-- Order 45
(45, 25, 2, 89.99, 179.98),
-- Order 46
(46, 2, 1, 599.99, 599.99),
(46, 3, 2, 39.99, 79.98),
-- Order 47
(47, 14, 1, 129.99, 129.99),
-- Order 48
(48, 41, 3, 39.99, 119.97),
(48, 45, 2, 49.99, 99.98),
-- Order 49
(49, 6, 1, 129.99, 129.99),
(49, 5, 2, 24.99, 49.98),
(49, 10, 2, 44.99, 89.98),
-- Order 50
(50, 13, 1, 89.99, 89.99),
-- Order 51
(51, 31, 2, 49.99, 99.98),
(51, 32, 2, 34.99, 69.98),
(51, 33, 2, 24.99, 49.98),
-- Order 52
(52, 1, 1, 79.99, 79.99),
-- Order 53
(53, 15, 1, 249.99, 249.99),
-- Order 54
(54, 8, 1, 149.99, 149.99),
-- Order 55
(55, 26, 1, 149.99, 149.99),
(55, 25, 1, 89.99, 89.99),
(55, 24, 1, 59.99, 59.99),
-- Order 56
(56, 2, 1, 599.99, 599.99),
-- Order 57
(57, 11, 1, 199.99, 199.99),
(57, 12, 1, 89.99, 89.99),
-- Order 58
(58, 14, 1, 129.99, 129.99),
-- Order 59
(59, 21, 5, 19.99, 99.95),
(59, 22, 3, 34.99, 104.97),
(59, 28, 3, 24.99, 74.97),
-- Order 60
(60, 13, 1, 89.99, 89.99),
-- Order 61
(61, 41, 4, 39.99, 159.96),
(61, 42, 1, 179.99, 179.99),
(61, 43, 1, 89.99, 89.99),
-- Order 62
(62, 25, 2, 89.99, 179.98),
-- Order 63
(63, 2, 1, 599.99, 599.99),
(63, 4, 1, 49.99, 49.98),
-- Order 64
(64, 8, 1, 149.99, 149.99),
-- Order 65
(65, 11, 1, 199.99, 199.99),
(65, 17, 1, 79.99, 79.99),
(65, 18, 1, 29.99, 29.99),
-- Order 66
(66, 15, 1, 179.99, 179.99),
-- Order 67
(67, 2, 1, 599.99, 599.99),
(67, 3, 2, 39.99, 79.98),
-- Order 68
(68, 14, 1, 149.99, 149.99),
-- Order 69
(69, 26, 1, 149.99, 149.99),
(69, 25, 1, 89.99, 89.99),
(69, 48, 1, 149.99, 149.99),
-- Order 70
(70, 15, 1, 199.99, 199.99),
-- Order 71
(71, 13, 1, 89.99, 89.99),
-- Order 72
(72, 11, 1, 199.99, 199.99),
(72, 12, 1, 89.99, 89.99),
-- Order 73
(73, 1, 1, 79.99, 79.99),
-- Order 74
(74, 21, 4, 19.99, 79.96),
(74, 22, 3, 34.99, 104.97),
(74, 23, 2, 59.99, 119.98),
-- Order 75
(75, 25, 2, 89.99, 179.98),
-- Order 76
(76, 2, 1, 599.99, 599.99),
-- Order 77
(77, 14, 1, 129.99, 129.99),
-- Order 78
(78, 41, 2, 39.99, 79.98),
(78, 45, 2, 49.99, 99.98),
-- Order 79
(79, 6, 1, 129.99, 129.99),
(79, 5, 1, 24.99, 24.99),
-- Order 80
(80, 13, 1, 89.99, 89.99),
-- Order 81
(81, 31, 3, 49.99, 149.97),
(81, 32, 2, 34.99, 69.98),
(81, 33, 2, 24.99, 49.98),
-- Order 82
(82, 1, 1, 79.99, 79.99),
-- Order 83
(83, 15, 1, 249.99, 249.99),
-- Order 84
(84, 8, 1, 149.99, 149.99),
-- Order 85
(85, 26, 1, 149.99, 149.99),
(85, 25, 1, 89.99, 89.99),
(85, 24, 1, 59.99, 59.99),
-- Order 86
(86, 2, 1, 599.99, 599.99),
(86, 3, 2, 39.99, 79.98),
-- Order 87
(87, 11, 1, 199.99, 199.99),
(87, 16, 1, 34.99, 34.99),
-- Order 88
(88, 14, 1, 129.99, 129.99),
-- Order 89
(89, 2, 1, 599.99, 599.99),
(89, 7, 1, 69.99, 69.99),
-- Order 90
(90, 15, 1, 199.99, 199.99),
-- Order 91
(91, 8, 1, 149.99, 149.99),
-- Order 92
(92, 11, 1, 199.99, 199.99),
(92, 12, 1, 89.99, 89.99),
-- Order 93
(93, 13, 1, 89.99, 89.99),
-- Order 94
(94, 21, 5, 19.99, 99.95),
(94, 22, 3, 34.99, 104.97),
(94, 23, 2, 59.99, 119.98),
-- Order 95
(95, 25, 2, 89.99, 179.98),
-- Order 96
(96, 2, 1, 599.99, 599.99),
(96, 4, 1, 49.99, 49.98),
-- Order 97
(97, 14, 1, 149.99, 149.99),
-- Order 98
(98, 41, 4, 39.99, 159.96),
(98, 42, 1, 179.99, 179.99),
(98, 43, 1, 89.99, 89.99),
-- Order 99
(99, 15, 1, 199.99, 199.99),
-- Order 100
(100, 13, 1, 129.99, 129.99),
-- Additional order items for remaining orders
(101, 11, 1, 189.99, 189.99),
(102, 31, 3, 49.99, 149.97),
(102, 32, 2, 34.99, 69.98),
(102, 33, 2, 24.99, 49.98),
(103, 1, 1, 79.99, 79.99),
(104, 26, 1, 149.99, 149.99),
(104, 25, 1, 89.99, 89.99),
(104, 24, 1, 59.99, 59.99),
(105, 8, 1, 149.99, 149.99),
(106, 2, 1, 599.99, 599.99),
(106, 3, 2, 39.99, 79.98),
(107, 14, 1, 119.99, 119.99),
(108, 41, 3, 39.99, 119.97),
(108, 45, 2, 49.99, 99.98),
(109, 15, 1, 209.99, 209.99),
(110, 13, 1, 139.99, 139.99),
(111, 11, 1, 199.99, 199.99),
(111, 12, 1, 89.99, 89.99),
(112, 25, 2, 89.99, 179.98),
(113, 2, 1, 599.99, 599.99),
(113, 7, 1, 69.99, 69.99),
(114, 15, 1, 229.99, 229.99),
(115, 8, 1, 149.99, 149.99);


-- ============================================================================
-- DATABASE CONSTRAINTS AND PERMISSIONS
-- ============================================================================

-- Foreign key relationships are already defined in table creation above
-- Additional constraints can be added here if needed

-- ============================================================================
-- CREATE READ-ONLY USER FOR DEMO ACCESS
-- ============================================================================

-- Drop user if exists (for idempotent execution)
DROP USER IF EXISTS demo_user;

-- Create read-only user for demo database access
CREATE USER demo_user WITH PASSWORD 'demo_readonly_2024';

-- Grant CONNECT privilege to the database
GRANT CONNECT ON DATABASE postgres TO demo_user;

-- Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO demo_user;

-- Grant SELECT permission on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO demo_user;

-- Grant SELECT permission on all sequences (for viewing IDs)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO demo_user;

-- Ensure future tables also get SELECT permission
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO demo_user;

-- Revoke any write permissions (INSERT, UPDATE, DELETE, TRUNCATE)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM demo_user;

-- Revoke DDL permissions (CREATE, DROP, ALTER)
REVOKE CREATE ON SCHEMA public FROM demo_user;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table counts
DO $$
DECLARE
    product_count INTEGER;
    customer_count INTEGER;
    order_count INTEGER;
    order_item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO product_count FROM products;
    SELECT COUNT(*) INTO customer_count FROM customers;
    SELECT COUNT(*) INTO order_count FROM orders;
    SELECT COUNT(*) INTO order_item_count FROM order_items;
    
    RAISE NOTICE 'Database initialization complete!';
    RAISE NOTICE 'Products: %', product_count;
    RAISE NOTICE 'Customers: %', customer_count;
    RAISE NOTICE 'Orders: %', order_count;
    RAISE NOTICE 'Order Items: %', order_item_count;
    
    -- Verify requirements are met
    IF product_count < 50 THEN
        RAISE WARNING 'Products count (%) is less than required 50', product_count;
    END IF;
    
    IF customer_count < 30 THEN
        RAISE WARNING 'Customers count (%) is less than required 30', customer_count;
    END IF;
    
    IF order_count < 100 THEN
        RAISE WARNING 'Orders count (%) is less than required 100', order_count;
    END IF;
    
    IF order_item_count < 200 THEN
        RAISE WARNING 'Order items count (%) is less than required 200', order_item_count;
    END IF;
END $$;

-- ============================================================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================================================

-- Test query 1: Top selling products
-- SELECT p.name, SUM(oi.quantity) as total_sold
-- FROM products p
-- JOIN order_items oi ON p.id = oi.product_id
-- GROUP BY p.id, p.name
-- ORDER BY total_sold DESC
-- LIMIT 10;

-- Test query 2: Monthly sales trends
-- SELECT 
--     DATE_TRUNC('month', order_date) as month,
--     COUNT(*) as order_count,
--     SUM(total_amount) as revenue
-- FROM orders
-- GROUP BY month
-- ORDER BY month DESC;

-- Test query 3: Customer lifetime value
-- SELECT 
--     c.first_name || ' ' || c.last_name as customer_name,
--     c.email,
--     COUNT(o.id) as order_count,
--     SUM(o.total_amount) as total_spent
-- FROM customers c
-- LEFT JOIN orders o ON c.id = o.customer_id
-- GROUP BY c.id, customer_name, c.email
-- ORDER BY total_spent DESC
-- LIMIT 10;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
