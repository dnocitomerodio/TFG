import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "../utils/api";

const Community = () => {
  const [threads, setThreads] = useState([]);
  const [newThread, setNewThread] = useState({
    title: "",
    content: "",
  });
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    axios
      .get("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        return axios.get("/api/community/", {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((response) => {
        setThreads(response.data);
        setIsLoggedIn(true);
      })
      .catch((err) => {
        setError(err.response?.data?.msg || "Failed to load community data");
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setError("Please log in to create a thread");
      return;
    }
    try {
      const response = await axios.post("/api/community/", newThread, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setThreads([response.data, ...threads]);
      setNewThread({ title: "", content: "" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create thread");
    }
  };

  return (
    <section className="container py-5">
      <div className="row text-center pt-5 pb-3">
        <div className="col-lg-6 m-auto">
          <h1 className="h1">Community Forum</h1>
          <p>
            Join the <strong>Musaica</strong> community to discuss artworks,
            share your <strong>Collection</strong> insights, and connect with
            art enthusiasts.
          </p>
        </div>
      </div>
      {error && (
        <div className="row mb-3">
          <div className="col-lg-8 m-auto">
            <div className="alert alert-danger">{error}</div>
          </div>
        </div>
      )}
      {isLoggedIn && (
        <div className="row mb-5">
          <div className="col-lg-8 m-auto">
            <h2 className="h5 text-center mb-4">Start a New Discussion</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Thread Title"
                  value={newThread.title}
                  onChange={(e) =>
                    setNewThread({ ...newThread, title: e.target.value })
                  }
                  required
                  maxLength="100"
                />
              </div>
              <div className="mb-3">
                <textarea
                  className="form-control"
                  placeholder="Your Message"
                  value={newThread.content}
                  onChange={(e) =>
                    setNewThread({ ...newThread, content: e.target.value })
                  }
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn btn-success">
                Create Thread
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="row">
        {threads.length === 0 && (
          <p className="text-center">
            No threads yet. Be the first to start a discussion!
          </p>
        )}
        {threads.map((thread) => (
          <div key={thread._id} className="col-md-6 col-lg-4 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-comments"></i>
              </div>
              <h2 className="h5 mt-4 text-center">
                <Link
                  to={`/community/${thread._id}`}
                  className="text-decoration-none"
                >
                  {thread.title}
                </Link>
              </h2>
              <p className="text-center px-3">
                Started by {thread.author_email} on{" "}
                {new Date(thread.created_at).toLocaleDateString()}
                <br />
                {thread.replies.length}{" "}
                {thread.replies.length === 1 ? "Reply" : "Replies"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Community;
