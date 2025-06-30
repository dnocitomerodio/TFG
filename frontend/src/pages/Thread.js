import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/api";

const Thread = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [thread, setThread] = useState(null);
  const [newReply, setNewReply] = useState({ content: "" });
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [sort, setSort] = useState("date");

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    const fetchData = async () => {
      try {
        const profileResponse = await axios.get("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(profileResponse.data);
        const threadResponse = await axios.get(
          `/api/community/${id}?sort=${sort}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log("Thread response:", threadResponse.data);
        setThread(JSON.parse(JSON.stringify(threadResponse.data)));
        setIsLoggedIn(true);
      } catch (err) {
        setError(err.response?.data?.msg || "Failed to load thread");
        console.error("Fetch thread error:", err.response?.data || err);
      }
    };
    fetchData();
  }, [id, sort]);

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
      setThread(JSON.parse(JSON.stringify(response.data)));
      setNewReply({ content: "" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to post reply");
    }
  };

  const handleVote = async (replyIndex, voteType) => {
    if (!isLoggedIn) {
      setError("Please log in to vote");
      return;
    }
    try {
      const response = await axios.post(
        replyIndex !== null
          ? `/api/community/${id}/replies/${replyIndex}/vote`
          : `/api/community/${id}/vote`,
        { vote_type: voteType },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      setThread(JSON.parse(JSON.stringify(response.data)));
    } catch (err) {
      setError(
        err.response?.data?.msg ||
          `Failed to ${voteType} ${replyIndex !== null ? "reply" : "thread"}`
      );
    }
  };

  const handleDelete = async () => {
    if (!isLoggedIn) {
      setError("Please log in to delete");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this thread?")) return;
    try {
      await axios.delete(`/api/community/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      navigate("/community", { state: location.state });
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete thread");
    }
  };

  const handleDeleteReply = async (replyIndex) => {
    if (!isLoggedIn) {
      setError("Please log in to delete");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    try {
      await axios.delete(`/api/community/${id}/replies/${replyIndex}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setThread({
        ...thread,
        replies: thread.replies.filter((_, i) => i !== replyIndex),
      });
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete reply");
    }
  };

  const handleBack = () => {
    navigate("/community", { state: location.state });
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
      <div className="row text-start mb-3">
        <div className="col-lg-8">
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Community
          </button>
        </div>
      </div>
      <div className="row text-center pb-3">
        <div className="col-lg-8 m-auto">
          <h1 className="h1">{thread.title}</h1>
          <p>
            Started by {thread.author_email} on{" "}
            {new Date(thread.created_at).toLocaleDateString()}
            <br />
            Likes: {thread.likes || 0} | Dislikes: {thread.dislikes || 0}
          </p>
          {isLoggedIn && (
            <div>
              <button
                className="btn btn-outline-success me-2"
                onClick={() => handleVote(null, "like")}
              >
                Like
              </button>
              <button
                className="btn btn-outline-danger me-2"
                onClick={() => handleVote(null, "dislike")}
              >
                Dislike
              </button>
              {(user?.role === "admin" ||
                user?.email === thread.author_email) && (
                <button className="btn btn-danger" onClick={handleDelete}>
                  Delete Thread
                </button>
              )}
            </div>
          )}
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
          <select
            className="form-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Sort by Date</option>
            <option value="popularity">Sort by Popularity</option>
          </select>
        </div>
      </div>
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
                <p>
                  Likes: {reply.likes || 0} | Dislikes: {reply.dislikes || 0}
                </p>
                {isLoggedIn && (
                  <div>
                    <button
                      className="btn btn-outline-success me-2"
                      onClick={() => handleVote(index, "like")}
                    >
                      Like
                    </button>
                    <button
                      className="btn btn-outline-danger me-2"
                      onClick={() => handleVote(index, "dislike")}
                    >
                      Dislike
                    </button>
                    {(user?.role === "admin" ||
                      user?.email === reply.author_email) && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteReply(index)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
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
