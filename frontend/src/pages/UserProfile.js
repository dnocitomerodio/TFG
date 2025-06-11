import React, { useState, useEffect } from "react";
import axios from "../utils/api";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState("none");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const { data } = await axios.get("/user/profile");
        setProfile(data);
        setLevel(data.level || "none");
        setRetryCount(0);
      } catch (err) {
        console.error("Profile error:", err);
        if (err.code === "ERR_NETWORK") {
          setError(
            `Unable to connect to the server. Retry attempt ${
              retryCount + 1
            } of 3.`
          );
          setRetryCount(retryCount + 1);
        } else {
          setError(err.response?.data?.msg || "Error loading profile.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [navigate, retryCount]);

  useEffect(() => {
    if (error.includes("Unable") && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, retryCount]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setIsLoading(true);
    try {
      await axios.put("/user/update", { password });
      setSuccess("Password updated successfully.");
      setPassword("");
    } catch (err) {
      console.error("Update error:", err);
      setError(err.response?.data?.msg || "Error updating password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLevel = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      await axios.put("/user/update_level", { level });
      setSuccess("Level updated successfully.");
      setProfile({ ...profile, level });
    } catch (err) {
      console.error("Level error:", err);
      setError(err.response?.data?.msg || "Error updating level.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account?"))
      return;
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      await axios.delete("/user/delete");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      navigate("/login");
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.response?.data?.msg || "Error deleting account.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile && !isLoading) return null;

  return (
    <div className="container mt-5">
      <h2>My Profile</h2>
      {isLoading && (
        <div className="text-center">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      {error && <p className="text-danger">{error}</p>}
      {success && <p className="text-success">{success}</p>}
      {profile && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Profile Details</h5>
            <p className="card-text">
              <strong>Email:</strong> {profile.email}
            </p>
            <p className="card-text">
              <strong>Role:</strong> {profile.role || "user"}
            </p>
            <p className="card-text">
              <strong>Level:</strong> {profile.level || "none"}
            </p>
          </div>
        </div>
      )}
      <h3>Update Password</h3>
      <form onSubmit={handleUpdatePassword} className="mb-4">
        <div className="input-group">
          <input
            type="password"
            className="form-control"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <button
            className="btn btn-success"
            type="submit"
            disabled={isLoading}
          >
            Update Password
          </button>
        </div>
      </form>
      <h3>Update Level</h3>
      <div className="mb-4">
        <select
          className="form-select w-auto"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          disabled={isLoading}
        >
          <option value="none">None</option>
          <option value="beginner">Beginner</option>
          <option value="expert">Expert</option>
        </select>
        <button
          className="btn btn-success mt-2"
          onClick={handleUpdateLevel}
          disabled={isLoading}
        >
          Update Level
        </button>
      </div>
      <h3>Delete Account</h3>
      <button
        className="btn btn-danger"
        onClick={handleDeleteAccount}
        disabled={isLoading}
      >
        Delete My Account
      </button>
    </div>
  );
};

export default UserProfile;
