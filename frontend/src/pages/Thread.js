import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../utils/api";

const Thread = () => {
  const { id } = useParams();
  const [thread, setThread] = useState(null);
  const [newReply, setNewReply] = useState({ content: "" });
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
        return axios.get(`/api/community/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((response) => {
        setThread(response.data);
        setIsLoggedIn(true);
      })
      .catch((err) => {
        setError(err.response?.data?.msg || "Failed to load thread");
      });
  }, [id]);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setError("Please log in to reply");
      return;
    }
    try {
      const response = await axios.post(
        `/api/community/${id}/replies`,
        newReply,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      setThread(response.data);
      setNewReply({ content: "" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to post reply");
    }
  };

  if (!thread)
    return (
      <div className="container py-5">
        <p>Loading...</p>
        {error && <div className="alert alert-danger">{error}</div>}
      </div>
    );

  return (
    <section className="container py-5">
      <div className="row text-center pt-5 pb-3">
        <div className="col-lg-8 m-auto">
          <h1 className="h1">{thread.title}</h1>
          <p>
            Started by {thread.author_email} on{" "}
            {new Date(thread.created_at).toLocaleDateString()}
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
      <div className="row">
        <div className="col-lg-8 m-auto">
          <div className="card mb-4 shadow">
            <div className="card-body text-start">
              <p>{thread.content}</p>
              <small className="text-muted">
                Posted by {thread.author_email} on{" "}
                {new Date(thread.created_at).toLocaleDateString()}
              </small>
            </div>
          </div>
          {thread.replies.map((reply, index) => (
            <div key={index} className="card mb-3 shadow">
              <div className="card-body text-start">
                <p>{reply.content}</p>
                <small className="text-muted">
                  Posted by {reply.author_email} on{" "}
                  {new Date(reply.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))}
          {isLoggedIn && (
            <div className="mt-5">
              <h2 className="h5 mb-4">Post a Reply</h2>
              <form onSubmit={handleReplySubmit}>
                <div className="mb-3">
                  <textarea
                    className="form-control"
                    placeholder="Your Reply"
                    value={newReply.content}
                    onChange={(e) =>
                      setNewReply({ ...newReply, content: e.target.value })
                    }
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-success">
                  Post Reply
                </button>
              </form>
            </div>
          )}
          {!isLoggedIn && (
            <p className="text-center mt-5">
              <Link to="/login">Log in</Link> to post a reply.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default Thread;
