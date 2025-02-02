import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuthentication = async () => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");

      if (token && userId) {
        try {
          const response = await axios.post(
            "http://localhost:8080/api/auth/validate",
            { userId },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.status === 200) {
            setIsAuthenticated(true);
            setMessage(`Welcome back, ${response.data.username}!`);
          }
        } catch (error) {
          console.error("Token validation failed");
          setIsAuthenticated(false);
        }
      }
    };

    verifyAuthentication();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:8080/api/auth/login",
        formData
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userId", response.data.user._id);

      setMessage(`Welcome, ${response.data.user.username}!`);
      navigate("/");
    } catch (error) {
      setMessage(error.response?.data?.message || "An error occurred.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setIsAuthenticated(false);
    setMessage("");
  };

  // Si ya estás autenticado, muestra el botón de logout
  if (isAuthenticated) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-4" style={{ width: "400px" }}>
          <h2 className="text-center mb-4">You are logged in!</h2>
          <p className="text-center">{message}</p>
          <button onClick={handleLogout} className="btn btn-danger w-100">
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Página de inicio de sesión
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-success w-100">
            Login
          </button>
        </form>
        {message && <p className="text-center text-danger mt-3">{message}</p>}
        <div className="text-center mt-3">
          <a href="/register" className="text-decoration-none">
            Don't have an account? Register here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
