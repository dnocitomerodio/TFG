import React from "react";
import { Link } from "react-router-dom";

const ArtPieceCard = ({ artpiece, handleRemove, isLoading }) => {
  return (
    <div className="card h-100 shadow-sm rounded">
      {artpiece.image && (
        <img
          src={artpiece.image}
          alt={artpiece.title || "Art piece"}
          className="card-img-top rounded-top"
          style={{ height: "200px", objectFit: "cover" }}
        />
      )}
      <div className="card-body d-flex flex-column">
        <h5 className="card-title">{artpiece.title || "Untitled"}</h5>
        <p className="card-text">Artist: {artpiece.author || "Unknown"}</p>
        <p className="card-text">Museum: {artpiece.museum || "Unknown"}</p>
        <div className="mt-auto d-flex gap-2">
          <Link
            to={`/collection/artpiece/${artpiece.external_id}`}
            className="btn btn-success btn-sm"
          >
            View Details
          </Link>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleRemove(artpiece.external_id)}
            disabled={isLoading}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArtPieceCard;
