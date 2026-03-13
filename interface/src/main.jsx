import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { store } from "./store";
import { setTokenFromStorage } from "./store/slices/authSlice";
import "./index.css";

// Check for token in localStorage on app load
const token = localStorage.getItem("authToken");
if (token) {
	store.dispatch(setTokenFromStorage(token));
}

ReactDOM.createRoot(document.getElementById("root")).render(
	<Provider store={store}>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</Provider>
);
