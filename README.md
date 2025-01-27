# Art Gallery Platform

## Overview

This project aims to create an interactive web platform for users to explore, save, and receive recommendations about artworks and museum exhibitions. The current progress focuses on building a scalable backend and preparing the project for future phases, including frontend integration and additional features.

## Features Implemented

### Backend (Flask)

- **User Authentication**:

  - Register and login with email/password.
  - Google OAuth integration for seamless login.
  - JWT-based authentication.
  - Role management (User and Admin).
  - Password recovery functionality.

- **Art Pieces**:

  - CRUD operations for artworks.
  - Fetch real data from external APIs (e.g., Wikidata).
  - Support for pagination when exploring art pieces.

- **Favorites Management**:

  - Users can mark and unmark artworks as favorites.
  - Retrieve user-specific favorite artworks.

- **API Documentation**:
  - Swagger is used for API documentation with detailed examples.

### Database

- **MongoDB**:
  - Central database for storing user information, artworks, and user favorites.
  - Strict data validation to ensure consistency.

### Modular Structure

The backend follows a modular structure to ensure scalability and maintainability:

```
project/
│
├── app/
│   ├── __init__.py        # Application factory.
│   ├── models.py          # Data models for users and artworks.
│   ├── routes/            # Blueprint for routing.
│   │   ├── __init__.py
│   │   ├── auth.py        # Authentication routes.
│   │   ├── artpiece.py    # Art piece routes.
│   │   └── user.py        # User routes.
│   ├── services/          # External API integrations.
│   │   ├── __init__.py
│   │   └── external_api.py
│   └── utils.py           # Utility functions.
│
├── .env                   # Environment variables (e.g., MongoDB URI, JWT Secret).
├── requirements.txt       # Python dependencies.
├── run.py                 # Main entry point for running the Flask app.
```

## Requirements

- Python 3.8+
- MongoDB Atlas (or local instance).

### Python Libraries

The project uses the following key libraries:

- `Flask`
- `Flask-RESTful`
- `Flask-PyMongo`
- `Flask-Bcrypt`
- `Flask-JWT-Extended`
- `Requests`
- `Python-Dotenv`

### Installation Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-repo/art-gallery-platform.git
   cd art-gallery-platform
   ```

2. **Create a virtual environment**:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   Create a `.env` file in the root directory with the following:

   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   JWT_SECRET_KEY=your_jwt_secret_key
   ```

5. **Run the Flask application**:

   ```bash
   python run.py
   ```

6. **Access the application**:
   - The API will be available at `http://127.0.0.1:5000/`.

### Example Endpoints

- **User Authentication**:

  - POST `/auth/register`
  - POST `/auth/login`
  - POST `/auth/recover-password`

- **Art Pieces**:
  - GET `/artpiece/` - Retrieve artworks (supports pagination and external API fallback).
- **User Favorites**:
  - GET `/user/favorites` - Get user’s favorite artworks.
  - POST `/user/favorites` - Add artwork to favorites.

## Future Work

- **Frontend**: Build an interactive user interface using React.js.
- **Notifications**: Implement real-time notifications for exhibitions.
- **Advanced Recommendations**: Leverage AI models for personalized recommendations.
- **Search and Filters**: Improve the search experience with advanced filtering capabilities.

## Contributing

Feel free to contribute by opening issues or submitting pull requests.

## License

This project is licensed under the MIT License.
