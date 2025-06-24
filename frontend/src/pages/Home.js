import React from "react";

const Home = () => {
  return (
    <div
      id="template-mo-zay-hero-carousel"
      className="carousel slide"
      data-bs-ride="carousel"
    >
      {/* Indicadores */}
      <ol className="carousel-indicators">
        <li
          data-bs-target="#template-mo-zay-hero-carousel"
          data-bs-slide-to="0"
          className="active"
        ></li>
        <li
          data-bs-target="#template-mo-zay-hero-carousel"
          data-bs-slide-to="1"
        ></li>
        <li
          data-bs-target="#template-mo-zay-hero-carousel"
          data-bs-slide-to="2"
        ></li>
      </ol>

      {/* Slides */}
      <div className="carousel-inner">
        {/* Slide 1 */}
        <div className="carousel-item active">
          <div className="container">
            <div className="row p-5">
              <div className="mx-auto col-md-8 col-lg-6 order-lg-last">
                <img
                  className="img-fluid"
                  src="/assets/img/banner_img_01.jpg"
                  alt="Banner 1"
                />
              </div>
              <div className="col-lg-6 mb-0 d-flex align-items-center">
                <div className="text-align-left align-self-center">
                  <h1 className="h1 text-success">
                    Start with <b>Musaica</b>
                  </h1>
                  <h3 className="h2">Build and track your art collection</h3>
                  <p>
                    Create your <strong>Collection</strong> in{" "}
                    <strong>Musaica</strong>. Add your favorite artworks and set
                    your mobility area in your profile to get alerts when your
                    saved pieces are nearby.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide 2 */}
        <div className="carousel-item">
          <div className="container">
            <div className="row p-5">
              <div className="mx-auto col-md-8 col-lg-6 order-lg-last">
                <img
                  className="img-fluid"
                  src="/assets/img/banner_img_02.jpg"
                  alt="Banner 2"
                />
              </div>
              <div className="col-lg-6 mb-0 d-flex align-items-center">
                <div className="text-align-left">
                  <h1 className="h1">Personalized Art Insights</h1>
                  <h3 className="h2">
                    Get AI descriptions and recommendations
                  </h3>
                  <p>
                    Explore art with <strong>Musaica</strong>’s AI-powered
                    descriptions tailored to your interests. Visit your profile
                    to set preferences and receive curated artwork
                    recommendations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide 3 */}
        <div className="carousel-item">
          <div className="container">
            <div className="row p-5">
              <div className="mx-auto col-md-8 col-lg-6 order-lg-last">
                <img
                  className="img-fluid"
                  src="/assets/img/banner_img_03.jpg"
                  alt="Banner 3"
                />
              </div>
              <div className="col-lg-6 mb-0 d-flex align-items-center">
                <div className="text-align-left">
                  <h1 className="h1">Find Art Nearby</h1>
                  <h3 className="h2">Search and stay updated on local art</h3>
                  <p>
                    Use the <strong>Search</strong> bar to find artworks by
                    title or artist near your location. Add pieces to your{" "}
                    <strong>Collection</strong> to get alerts when they’re
                    within your mobility area.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <a
        className="carousel-control-prev text-decoration-none w-auto ps-3"
        href="#template-mo-zay-hero-carousel"
        role="button"
        data-bs-slide="prev"
      >
        <i className="fas fa-chevron-left"></i>
      </a>
      <a
        className="carousel-control-next text-decoration-none w-auto pe-3"
        href="#template-mo-zay-hero-carousel"
        role="button"
        data-bs-slide="next"
      >
        <i className="fas fa-chevron-right"></i>
      </a>
    </div>
  );
};

export default Home;
