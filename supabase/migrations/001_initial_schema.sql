-- Initial database schema for Supabase PostgreSQL
-- This replaces the SQLite schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    driver_pay_type VARCHAR(20) DEFAULT 'percentage',
    percentage_rate DECIMAL(5,4) DEFAULT 0.68,
    fuel_road_use_tax DECIMAL(5,4) DEFAULT 0.01,
    maintenance_reserve DECIMAL(5,4) DEFAULT 0.05,
    bond_deposit DECIMAL(5,4) DEFAULT 0.04,
    mrp_fee DECIMAL(5,4) DEFAULT 0.09,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loads table
CREATE TABLE loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    load_number VARCHAR(50),
    pickup_date DATE,
    delivery_date DATE,
    pickup_location VARCHAR(255),
    delivery_location VARCHAR(255),
    miles INTEGER,
    rate DECIMAL(10,2),
    fuel_advance DECIMAL(10,2) DEFAULT 0,
    fuel_discount DECIMAL(10,2) DEFAULT 0,
    driver_pay DECIMAL(10,2),
    driver_pay_type VARCHAR(20),
    percentage_rate DECIMAL(5,4),
    fuel_road_use_tax DECIMAL(5,4),
    maintenance_reserve DECIMAL(5,4),
    bond_deposit DECIMAL(5,4),
    mrp_fee DECIMAL(5,4),
    other_deductions DECIMAL(10,2) DEFAULT 0,
    net_to_truck DECIMAL(10,2),
    settlement_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fuel_stops table
CREATE TABLE fuel_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    gallons DECIMAL(8,2) NOT NULL,
    price_per_gallon DECIMAL(6,3) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bug_reports table
CREATE TABLE bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_loads_user_id ON loads(user_id);
CREATE INDEX idx_loads_load_number ON loads(load_number);
CREATE INDEX idx_fuel_stops_user_id ON fuel_stops(user_id);
CREATE INDEX idx_fuel_stops_load_id ON fuel_stops(load_id);
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loads_updated_at BEFORE UPDATE ON loads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_stops_updated_at BEFORE UPDATE ON fuel_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();