import requests

class ExternalAPI:
    def __init__(self, base_url):
        self.base_url = base_url

    def fetch_art_pieces(self, query, limit=10):
        """
        Realiza una consulta a la API externa para buscar obras de arte.
        """
        try:
            response = requests.get(
                f"{self.base_url}",
                params={"query": query, "limit": limit},
            )
            if response.status_code == 200:
                return response.json().get("results", [])
            else:
                response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error al consultar la API externa: {e}")
            return []

# Ejemplo de uso
# api = ExternalAPI("https://api.wikidata.org/sparql")
# results = api.fetch_art_pieces("Mona Lisa", limit=5)
