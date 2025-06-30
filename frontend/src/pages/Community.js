/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/api";

const Community = () => {
  const [threads, setThreads] = useState([]);
  const [newThread, setNewThread] = useState({ title: "", content: "" });
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    const state = location.state || {};
    setSearchQuery(state.searchQuery || "");
    setPage(state.page || 1);

    const fetchData = async () => {
      try {
        const profileResponse = await axios.get("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(profileResponse.data);
        const endpoint = searchQuery
          ? `/api/community/search?q=${encodeURIComponent(
              searchQuery
            )}&page=${page}&per_page=10`
          : `/api/community/?page=${page}&per_page=10`;
        const threadsResponse = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setThreads(threadsResponse.data.threads);
        setTotalPages(Math.ceil(threadsResponse.data.total / 10));
        setIsLoggedIn(true);
      } catch (err) {
        setError(err.response?.data?.msg || "Failed to load community data");
      }
    };
    fetchData();
  }, [page, searchQuery, location.state]);

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

  const handleVote = async (threadId, voteType) => {
    if (!isLoggedIn) {
      setError("Please log in to vote");
      return;
    }
    try {
      const response = await axios.post(
        `/api/community/${threadId}/vote`,
        { vote_type: voteType },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      setThreads(threads.map((t) => (t._id === threadId ? response.data : t)));
    } catch (err) {
      setError(err.response?.data?.msg || `Failed to ${voteType} thread`);
    }
  };

  const handleDelete = async (threadId) => {
    if (!isLoggedIn) {
      setError("Please log in to delete");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this thread?")) return;
    try {
      await axios.delete(`/api/community/${threadId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setThreads(threads.filter((t) => t._id !== threadId));
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete thread");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <section className="container py-5">
      <div className="row text-center pt-5 pb-3">
        <div className="col-lg-6 m-auto">
          <h1 className="h1">Community Forum</h1>
          <p>
            Join the <strong>Musaica</strong> community to discuss artworks,
            share your insights, and connect with art enthusiasts.
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
      <div className="row mb-3">
        <div className="col-lg-8 m-auto">
          <form onSubmit={handleSearch}>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Search threads by title or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </div>
          </form>
        </div>
      </div>
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
            <Link
              to={`/community/${thread._id}`}
              className="text-decoration-none"
              state={{ searchQuery, page }}
            >
              <div
                className="h-100 py-5 services-icon-wap shadow"
                style={{ cursor: "pointer" }}
              >
                <div className="h1 text-success text-center">
                  <i className="fa fa-comments"></i>
                </div>
                <h2 className="h5 mt-4 text-center">{thread.title}</h2>
                <p className="text-center px-3">
                  Started by {thread.author_email} on{" "}
                  {new Date(thread.created_at).toLocaleDateString()}
                  <br />
                  {thread.replies.length}{" "}
                  {thread.replies.length === 1 ? "Reply" : "Replies"}
                  <br />
                  Likes: {thread.likes || 0} | Dislikes: {thread.dislikes || 0}
                </p>
              </div>
            </Link>
            {isLoggedIn &&
              (user?.role === "admin" ||
                user?.email === thread.author_email) && (
                <button
                  className="btn btn-danger mt-2"
                  onClick={() => handleDelete(thread._id)}
                >
                  Delete
                </button>
              )}
          </div>
        ))}
      </div>
      <div className="row">
        <div className="col-lg-8 m-auto text-center">
          <button
            className="btn btn-primary me-2"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-primary ms-2"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default Community;
