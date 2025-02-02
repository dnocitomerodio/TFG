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
                    <b>Musaica</b> management
                  </h1>
                  <h3 className="h2">
                    Perfect for keeping a registry of a museum or a private
                    collection
                  </h3>
                  <p>
                    Musaica is an art collections management application
                    developed by Daniel Nocito Merodio. This work is intended
                    for the teacher only and any further exposure isn't intended
                    by its creator.
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
                  <h1 className="h1">How does collections work?</h1>
                  <h3 className="h2">
                    Register all the art pieces in your possession to keep track
                    of them
                  </h3>
                  <p>
                    Each user has a collection assigned to them. Your{" "}
                    <strong>Collection</strong> starts empty, but you can add
                    art to increase it. Later on, you can manage the collection
                    by adding sub-categories to it.
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
                  <h1 className="h1">Search for art</h1>
                  <h3 className="h2">
                    If you want to explore or look up for art, use the search
                    category or our search bar.
                  </h3>
                  <p>
                    We bring you 100% free CSS templates for your websites. If
                    you wish to support TemplateMo, please make a small
                    contribution via PayPal or tell your friends about our
                    website. Thank you.
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
