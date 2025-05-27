import requests
from urllib.parse import quote


class ExternalAPI:
    def __init__(self, base_url):
        self.base_url = base_url

    def fetch_art_pieces(self, query, limit=10):
        """
        Realiza una consulta a la API externa para buscar obras de arte.
        """
        sparql_query = f"""
        SELECT ?item ?itemLabel ?creatorLabel ?image ?inception ?styleLabel ?museumLabel ?location ?mediumLabel ?dimensions ?description
        WHERE {{
            ?item wdt:P31 wd:Q3305213;
                  rdfs:label ?label.
            FILTER(CONTAINS(LCASE(?label), LCASE("{query}")) && lang(?label) = "en")
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wdt:P18 ?image. }}
            OPTIONAL {{ ?item wdt:P571 ?inception. }}
            OPTIONAL {{ ?item wdt:P135 ?style. }}
            OPTIONAL {{ ?item wdt:P276 ?museum. }}
            OPTIONAL {{ ?item wdt:P625 ?location. }}
            OPTIONAL {{ ?item wdt:P186 ?medium. }}
            OPTIONAL {{ ?item wdt:P2048 ?dimensions. }}
            OPTIONAL {{ ?item schema:description ?description. FILTER(lang(?description) = "en") }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        LIMIT {limit}
        """
        encoded_query = quote(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json().get("results", {}).get("bindings", [])
            else:
                response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error al consultar la API externa: {e}")
            return []


def parse_location(location_value):
    if not location_value:
        return {}
    try:
        coords = location_value.replace("Point(", "").replace(")", "")
        lon_str, lat_str = coords.strip().split()
        return {
            "lat": float(lat_str),
            "lon": float(lon_str)
        }
    except Exception:
        return {}


def parse_result(result):
    def get_value(field):
        return result.get(field, {}).get("value")

    location_raw = get_value("location")

    return {
        "_id": get_value("item"),
        "title": get_value("itemLabel"),
        "author": get_value("creatorLabel"),
        "year": get_value("inception"),
        "style": get_value("styleLabel"),
        "museum": get_value("museumLabel"),
        "location": parse_location(location_raw),
        "medium": get_value("mediumLabel"),
        "dimensions": get_value("dimensions"),
        "image": get_value("image"),
        "description": get_value("description"),
        "tags": [],
        "external_id": get_value("item"),
        "source_url": get_value("item"),
    }
