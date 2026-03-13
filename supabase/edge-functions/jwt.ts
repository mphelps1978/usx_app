// JWT utilities for Deno/Supabase Edge Functions
// This replaces the Node.js JWT implementation

import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

// Generate JWT token
export async function generateJWT(
	payload: any,
	secret: string,
	expiresIn: string = "24h"
): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };

	// Handle expiration time
	let expirationTime: number;
	if (expiresIn.endsWith("h")) {
		const hours = parseInt(expiresIn.slice(0, -1));
		expirationTime = Math.floor(Date.now() / 1000) + hours * 3600;
	} else if (expiresIn.endsWith("d")) {
		const days = parseInt(expiresIn.slice(0, -1));
		expirationTime = Math.floor(Date.now() / 1000) + days * 24 * 3600;
	} else {
		expirationTime = Math.floor(Date.now() / 1000) + 86400; // Default 24 hours
	}

	const tokenPayload = {
		...payload,
		exp: expirationTime,
		iat: Math.floor(Date.now() / 1000),
	};

	return await create(header, tokenPayload, secret);
}

// Verify JWT token
export async function verifyJWT(token: string, secret: string): Promise<any> {
	try {
		const payload = await verify(token, secret);
		return payload;
	} catch (error) {
		throw new Error("Invalid token");
	}
}

// Hash password (basic implementation for Deno)
export async function hashPassword(password: string): Promise<string> {
	// For production, you should use a proper password hashing library
	// This is a simple implementation for now
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return hashHex;
}

// Verify password
export async function verifyPassword(
	password: string,
	hash: string
): Promise<boolean> {
	const passwordHash = await hashPassword(password);
	return passwordHash === hash;
}
