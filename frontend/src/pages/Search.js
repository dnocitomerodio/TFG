import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/api";

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [offset, setOffset] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 10;
  const navigate = useNavigate();

  const fetchRecommendations = async (newOffset) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get("/api/artpiece/recommendations", {
        params: {
          level: "none",
          offset: newOffset,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("Recommendations data:", response.data);
      const validRecommendations = (response.data || []).filter(
        (item) => item.external_id
      );
      setRecommendations(validRecommendations);
      if (validRecommendations.length < (response.data || []).length) {
        console.warn(
          "Filtered out recommendations with missing external_id:",
          (response.data || []).filter((item) => !item.external_id)
        );
      }
      setError("");
    } catch (err) {
      console.error("Recommendations fetch error:", {
        message: err.message,
        response: err.response
          ? {
              status: err.response.status,
              data: err.response.data,
              headers: err.response.headers,
            }
          : "No response (possible CORS issue)",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else {
        setError(err.response?.data?.msg || "Error loading recommendations.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e, offset = 0) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter a search term.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get("/api/artpiece/", {
        params: {
          query,
          limit: pageSize,
          offset: offset,
          expand: true,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      console.log("Search results:", response.data);
      const validResults = (response.data || []).filter(
        (item) => item.external_id
      );
      setResults(validResults);
      if (validResults.length < (response.data || []).length) {
        console.warn(
          "Filtered out search results with missing external_id:",
          (response.data || []).filter((item) => !item.external_id)
        );
      }
      validResults.forEach((item) => {
        if (!item.image) {
          console.warn(
            `No image for search result ${item.external_id} (${item.title})`
          );
        }
      });
      setError("");
    } catch (err) {
      console.error("Search error:", err.response?.data);
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else {
        setError(err.response?.data?.msg || "Error searching artworks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePagination = (direction) => {
    const newOffset =
      direction === "next" ? offset + pageSize : Math.max(offset - pageSize, 0);
    setOffset(newOffset);
    fetchRecommendations(newOffset);
  };

  const handleSearchPagination = (direction) => {
    const newOffset =
      direction === "next"
        ? searchOffset + pageSize
        : Math.max(searchOffset - pageSize, 0);
    setSearchOffset(newOffset);
    setSearchPage(
      direction === "next" ? searchPage + 1 : Math.max(searchPage - 1, 1)
    );
    handleSearch(null, newOffset);
  };

  const handleOtherSearch = (type) => {
    alert(`Search by ${type} will be implemented soon!`);
  };

  useEffect(() => {
    fetchRecommendations(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Search Artworks</h2>
      {error && <p className="text-danger mb-4">{error}</p>}

      {/* Search Bar */}
      <div className="mb-4">
        <form onSubmit={handleSearch}>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Search artworks by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="btn btn-success"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </div>

      {/* Other Search Modalities */}
      <div className="mb-4">
        <h5>Other Search Options</h5>
        <button
          className="btn btn-outline-primary me-2"
          onClick={() => handleOtherSearch("artist")}
        >
          Search by Artist
        </button>
        <button
          className="btn btn-outline-primary me-2"
          onClick={() => handleOtherSearch("nearby museums")}
        >
          Find Nearby Museums
        </button>
        <button
          className="btn btn-outline-primary"
          onClick={() => handleOtherSearch("museum works")}
        >
          Search by Museum
        </button>
      </div>

      {/* Results or Recommendations */}
      {results.length > 0 ? (
        <>
          <h4>Search Results</h4>
          <div className="row">
            {results.map((item, index) => (
              <div
                key={item.external_id || `result-${index}`}
                className="col-md-4 mb-4"
              >
                <div className="card shadow-sm">
                  {item.image && (
                    <img
                      src={
                        item.image.startsWith("commons:")
                          ? `http://commons.wikimedia.org/wiki/File:${item.image.replace(
                              "commons:",
                              ""
                            )}`
                          : item.image
                      }
                      alt={item.title}
                      className="card-img-top"
                      style={{
                        maxHeight: "200px",
                        objectFit: "contain",
                        padding: "0.5rem",
                      }}
                    />
                  )}
                  <div className="card-body">
                    <h5 className="card-title">{item.title || "Untitled"}</h5>
                    <p className="card-text">
                      <strong>Artist:</strong> {item.author || "Unknown"}
                    </p>
                    <p className="card-text">
                      <strong>Museum:</strong> {item.museum || "Unknown"}
                    </p>
                    <Link
                      to={`/artpiece/${item.external_id}`}
                      className="btn btn-primary btn-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="d-flex justify-content-between">
            <button
              className="btn btn-secondary"
              onClick={() => handleSearchPagination("prev")}
              disabled={searchOffset === 0 || isLoading}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSearchPagination("next")}
              disabled={results.length < pageSize || isLoading}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <h4>Recommended Artworks</h4>
          {isLoading ? (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>Loading recommendations...</p>
            </div>
          ) : recommendations.length > 0 ? (
            <>
              <div className="row">
                {recommendations.map((item, index) => (
                  <div
                    key={item.external_id || `recommendation-${index}`}
                    className="col-md-4 mb-4"
                  >
                    <div className="card shadow-sm">
                      {item.image && (
                        <img
                          src={
                            item.image.startsWith("commons:")
                              ? `http://commons.wikimedia.org/wiki/File:${item.image.replace(
                                  "commons:",
                                  ""
                                )}`
                              : item.image
                          }
                          alt={item.title}
                          className="card-img-top"
                          style={{
                            maxHeight: "200px",
                            objectFit: "contain",
                            padding: "0.5rem",
                          }}
                        />
                      )}
                      <div className="card-body">
                        <h5 className="card-title">
                          {item.title || "Untitled"}
                        </h5>
                        <p className="card-text">
                          <strong>Artist:</strong> {item.author || "Unknown"}
                        </p>
                        <p className="card-text">
                          <strong>Museum:</strong> {item.museum || "Unknown"}
                        </p>
                        <Link
                          to={`/artpiece/${item.external_id}`}
                          className="btn btn-primary btn-sm"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePagination("prev")}
                  disabled={offset === 0 || isLoading}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePagination("next")}
                  disabled={recommendations.length < pageSize || isLoading}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p>
              No recommendations available. Try adding some artworks to your
              collection!
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Search;
