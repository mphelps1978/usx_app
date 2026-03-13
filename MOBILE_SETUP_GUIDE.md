# Mobile Setup Guide for USX IC Books

## Quick Start - Access on iPad

### Step 1: Start Your Servers

**Terminal 1 - Start Backend API:**
```bash
cd api
npm start
```

**Terminal 2 - Start Frontend:**
```bash
cd interface
npm run dev
```

### Step 2: Find Your Network IP

Your computer's IP address is: **172.20.10.4**

### Step 3: Access from iPad

1. **Ensure both devices are on the same WiFi network**
2. Open Safari on your iPad
3. Go to: `http://172.20.10.4:5173`
4. The app should load with mobile-optimized interface

### Step 4: Install as PWA (Recommended)

1. Tap the **Share button** (square with arrow up)
2. Select **"Add to Home Screen"**
3. Name it **"USX Books"**
4. Tap **"Add"**
5. Launch from home screen for full app experience

## Alternative Access Methods

### Option 1: Using ngrok (Internet Access)
If you need access outside your local network:

```bash
# Install ngrok if not already installed
npm install -g ngrok

# Expose your frontend
ngrok http 5173

# Expose your backend
ngrok http 3001
```

Then use the ngrok URLs on your iPad.

### Option 2: Using Localhost Tunnel
```bash
# Install localtunnel
npm install -g localtunnel

# Start tunnel
lt --port 5173
```

## Troubleshooting

### App Won't Load on iPad
- ✅ **Check both devices are on same WiFi**
- ✅ **Verify servers are running** (check terminal for no errors)
- ✅ **Check firewall settings** (allow connections on port 5173)
- ✅ **Try restarting servers** if connection fails

### Can't Find IP Address
```bash
# Mac/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```

### CORS Issues
The Vite config has been updated to allow cross-origin requests. If you still have issues:

1. Check the browser console for errors
2. Ensure backend is running on `http://localhost:3001`
3. Verify frontend can reach the API

## Mobile Features

### Touch-Optimized Interface
- ✅ Large buttons (48px minimum)
- ✅ Optimized form inputs
- ✅ Responsive tables with sticky headers
- ✅ Bottom navigation for quick access

### PWA Benefits
- ✅ Works offline (cached data)
- ✅ App-like experience
- ✅ No App Store required
- ✅ Fast loading from cache

### iPad-Specific Features
- ✅ Landscape mode support
- ✅ High DPI display optimization
- ✅ Touch-friendly controls
- ✅ Optimized for 10" screen

## Security Notes

⚠️ **Local Network Only**: This setup only works on your local WiFi network for security reasons.

🔒 **No Internet Exposure**: Your data stays local and secure.

📱 **Secure Authentication**: Login credentials work the same as desktop.

## Next Steps

Once installed on your iPad:
1. **Log in** with your credentials (phelpscdl@gmail.com / Pwa2h2r!)
2. **Test all features** work on mobile
3. **Use the bottom navigation** for quick access
4. **Enjoy the mobile-optimized interface**!

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify both servers are running
3. Ensure devices are on same network
4. Restart servers if needed

Your app is now ready for mobile use! 🚀