import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/api";

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [level, setLevel] = useState("none");
  const [allUsers, setAllUsers] = useState([]);
  const [newRole, setNewRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState(1440);
  const [notificationRadius, setNotificationRadius] = useState(100);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem("token");

  const fetchProfile = async () => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.get("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(response.data);
      setLevel(response.data.level || "none");
      setIsAdmin(response.data.role === "admin");
      setNotificationsEnabled(response.data.notifications_enabled ?? true);
      setNotificationFrequency(response.data.notification_frequency ?? 1440);
      setNotificationRadius(response.data.notification_radius ?? 100);
      setLatitude(response.data.last_location?.lat ?? "");
      setLongitude(response.data.last_location?.lon ?? "");
      console.log(
        "Fetched notification_frequency:",
        response.data.notification_frequency
      ); // Debug
      setError("");
    } catch (err) {
      console.error("Profile fetch error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error fetching profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    const token = getToken();
    if (!token || !isAdmin) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await axios.get("/api/user/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllUsers(response.data);
      setError("");
    } catch (err) {
      console.error("All users fetch error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.response?.status === 403) {
        setError("Unauthorized to view all users");
        setIsAdmin(false);
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error fetching users");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(
        "/api/user/update",
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(response.data.msg);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Update password error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error updating password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLevel = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setError("");
    setSuccess("");
    if (!["none", "basic", "detailed"].includes(level)) {
      setError("Invalid level selected");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(
        "/api/user/update_level",
        { level },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(response.data.msg);
      await fetchProfile();
    } catch (err) {
      console.error("Update level error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error updating level");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNotificationSettings = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setError("");
    setSuccess("");
    if (latitude && isNaN(latitude)) {
      setError("Latitude must be a number");
      return;
    }
    if (longitude && isNaN(longitude)) {
      setError("Longitude must be a number");
      return;
    }
    if (isNaN(notificationRadius) || notificationRadius <= 0) {
      setError("Radius must be a positive number");
      return;
    }

    setIsLoading(true);
    try {
      const settings = {
        notifications_enabled: notificationsEnabled,
        notification_frequency: parseInt(notificationFrequency),
        notification_radius: parseFloat(notificationRadius),
      };
      if (latitude && longitude) {
        settings.last_location = {
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
        };
      }
      console.log("Sending notification settings:", settings); // Debug
      const response = await axios.put("/api/user/settings", settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(response.data.msg);
      // Delay re-fetch to ensure backend update propagates
      setTimeout(() => fetchProfile(), 500);
    } catch (err) {
      console.error("Update notification settings error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(
          err.response?.data?.msg || "Error updating notification settings"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setIsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setIsLoading(false);
      },
      (err) => {
        setError("Unable to retrieve your location: " + err.message);
        setIsLoading(false);
      }
    );
  };

  const handleDeleteAccount = async () => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await axios.delete("/api/user/delete", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(response.data.msg);
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      navigate("/login");
    } catch (err) {
      console.error("Delete account error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error deleting account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setError("");
    setSuccess("");
    if (!newRole) {
      setError("Role is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(
        `/api/user/update_role/${userId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(response.data.msg);
      setNewRole("");
      await fetchAllUsers();
    } catch (err) {
      console.error("Update user role error:", err);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.response?.status === 403) {
        setError("Unauthorized to update user roles");
        setIsAdmin(false);
      } else if (err.code === "ERR_NETWORK") {
        setError("Unable to connect to the server. Please try again.");
      } else {
        setError(err.response?.data?.msg || "Error updating user role");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Map notification frequency values to display names
  const frequencyDisplay = {
    60: "Hourly",
    360: "Every 6 Hours",
    720: "Every 12 Hours",
    1440: "Daily",
    10080: "Weekly",
  };

  return (
    <div className="container mt-5">
      <style>
        {`
          .btn-danger:disabled, .btn-primary:disabled {
            opacity: 1;
          }
          .artpiece-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            padding: 0.5rem;
            border-radius: 0.25rem;
          }
          .user-table th, .user-table td {
            vertical-align: middle;
          }
        `}
      </style>
      <h2 className="mb-4">User Profile</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading profile...</p>
        </div>
      ) : profile ? (
        <>
          {/* Profile Details */}
          <div className="card mb-4">
            <div className="card-header">
              <h4>Profile Details</h4>
            </div>
            <div className="card-body">
              <p>
                <strong>Email:</strong> {profile.email}
              </p>
              <p>
                <strong>Role:</strong> {profile.role || "User"}
              </p>
              <p>
                <strong>Description Level:</strong> {profile.level || "None"}
              </p>
              <p>
                <strong>Notifications Enabled:</strong>{" "}
                {profile.notifications_enabled ? "Yes" : "No"}
              </p>
              <p>
                <strong>Notification Frequency:</strong>{" "}
                {frequencyDisplay[profile.notification_frequency] ||
                  profile.notification_frequency + " minutes"}
              </p>
              <p>
                <strong>Notification Radius:</strong>{" "}
                {profile.notification_radius} km
              </p>
              <p>
                <strong>Last Location:</strong>{" "}
                {profile.last_location?.lat && profile.last_location?.lon
                  ? `Lat: ${profile.last_location.lat}, Lon: ${profile.last_location.lon}`
                  : "Not set"}
              </p>
              <p>
                <strong>Saved Artpieces:</strong>
              </p>
              {profile.artpieces && profile.artpieces.length > 0 ? (
                <div className="artpiece-list">
                  <ul className="list-group">
                    {profile.artpieces.map((artpiece, index) => (
                      <li key={index} className="list-group-item">
                        {artpiece}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>No artpieces saved.</p>
              )}
            </div>
          </div>

          {/* Update Notification Settings */}
          <div className="card mb-4">
            <div className="card-header">
              <h4>Notification Settings</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdateNotificationSettings}>
                <div className="mb-3 form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="notificationsEnabled"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                  <label
                    htmlFor="notificationsEnabled"
                    className="form-check-label"
                  >
                    Enable Email Notifications
                  </label>
                </div>
                <div className="mb-3">
                  <label htmlFor="notificationFrequency" className="form-label">
                    Notification Frequency
                  </label>
                  <select
                    className="form-select"
                    id="notificationFrequency"
                    value={notificationFrequency}
                    onChange={(e) => setNotificationFrequency(e.target.value)}
                  >
                    <option value={60}>Hourly</option>
                    <option value={360}>Every 6 Hours</option>
                    <option value={720}>Every 12 Hours</option>
                    <option value={1440}>Daily</option>
                    <option value={10080}>Weekly</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="notificationRadius" className="form-label">
                    Notification Radius (km)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="notificationRadius"
                    value={notificationRadius}
                    onChange={(e) => setNotificationRadius(e.target.value)}
                    min="1"
                    step="1"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Location</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Latitude"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Longitude"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleGetCurrentLocation}
                      disabled={isLoading}
                    >
                      Use Current Location
                    </button>
                  </div>
                  <small className="form-text text-muted">
                    Enter coordinates manually or use your current location.
                  </small>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Notification Settings"}
                </button>
              </form>
            </div>
          </div>

          {/* Update Password */}
          <div className="card mb-4">
            <div className="card-header">
              <h4>Update Password</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdatePassword}>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>

          {/* Update Description Level */}
          <div className="card mb-4">
            <div className="card-header">
              <h4>Update Description Level</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdateLevel}>
                <div className="mb-3">
                  <label htmlFor="level" className="form-label">
                    Description Level (we recommend you select None for faster
                    search)
                  </label>
                  <select
                    className="form-select"
                    id="level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Level"}
                </button>
              </form>
            </div>
          </div>

          {/* Delete Account */}
          <div className="card mb-4">
            <div className="card-header">
              <h4>Delete Account</h4>
            </div>
            <div className="card-body">
              <p className="text-danger">
                Warning: Deleting your account is permanent and cannot be
                undone.
              </p>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>

          {/* Admin: Manage Users */}
          {isAdmin && (
            <div className="card mb-4">
              <div className="card-header">
                <h4>Manage Users (Admin)</h4>
              </div>
              <div className="card-body">
                {allUsers.length > 0 ? (
                  <table className="table table-striped user-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Level</th>
                        <th>Update Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map((user) => (
                        <tr key={user._id}>
                          <td>{user.email}</td>
                          <td>{user.role || "User"}</td>
                          <td>{user.level || "None"}</td>
                          <td>
                            <form
                              onSubmit={(e) =>
                                handleUpdateUserRole(user._id, e)
                              }
                              className="d-flex"
                            >
                              <select
                                className="form-select me-2"
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                              >
                                <option value="">Select Role</option>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={isLoading}
                              >
                                Update
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No users found.</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <p>No profile data available.</p>
      )}
    </div>
  );
};

export default UserProfile;
