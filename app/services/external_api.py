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
        SELECT ?item ?itemLabel ?creatorLabel ?image
        WHERE {{
        ?item wdt:P31 wd:Q3305213;
                rdfs:label ?label.
        FILTER(CONTAINS(LCASE(?label), LCASE("{query}")) && lang(?label) = "en")
        OPTIONAL {{ ?item wdt:P170 ?creator. }}
        OPTIONAL {{ ?item wdt:P18 ?image. }}
        SERVICE wikibase:label {{ bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }}
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

# Example
#external_api = ExternalAPI("https://query.wikidata.org/sparql")
#results = external_api.fetch_art_pieces("Picasso", limit=10)
#print(results)
