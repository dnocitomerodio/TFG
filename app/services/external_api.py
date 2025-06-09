import requests
import os
from dotenv import load_dotenv
from urllib.parse import quote, quote_plus

load_dotenv()

class ExternalAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.europeana_api_key = os.getenv("EUROPEANA_API_KEY")
        self.cache = {}
        self.headers = {
            "User-Agent": "ArtExplorer/1.0 (contact@example.com)"
        }

    def fetch_art_pieces(self, query, limit=10, offset=0, expand=False):
        wikidata_raw = self.fetch_from_wikidata(query, limit, offset)
        results = [parse_result_wikidata(r) for r in wikidata_raw]

        seen = set()
        deduped_results = []
        for item in results:
            key = (
                (item.get("title") or "").strip().lower(),
                (item.get("author") or "").strip().lower()
            )
            if key not in seen:
                seen.add(key)
                deduped_results.append(item)

        return deduped_results

    def _expand_and_cache(self, query, limit, offset):
        cache_key = f"{query.lower()}|{limit}|{offset}|True"
        base_key = f"{query.lower()}|{limit}|{offset}|False"

        if cache_key in self.cache:
            return

        wikidata_results = self.cache.get(base_key, [])
        enriched_results = []

        europeana_results = self.fetch_from_europeana(query, limit)
        parsed_europeana = [parse_result_europeana(r) for r in europeana_results]

        met_results = self.fetch_from_met(query, limit)
        parsed_met = [parse_result_met(r) for r in met_results]

        for result in wikidata_results:
            enriched_result = self.enrich_result(result, parsed_europeana, parsed_met)
            enriched_results.append(enriched_result)

        def fix_private_collection(item):
            if not item.get("museum"):
                item["museum"] = "Private Collection"
            return item

        enriched_results = [fix_private_collection(r) for r in enriched_results]
        parsed_europeana = [fix_private_collection(r) for r in parsed_europeana]
        parsed_met = [fix_private_collection(r) for r in parsed_met]

        combined = enriched_results + parsed_europeana + parsed_met

        seen = set()
        deduped_results = []
        for item in combined:
            key = (
                (item.get("title") or "").strip().lower(),
                (item.get("author") or "").strip().lower()
            )
            if key not in seen:
                seen.add(key)
                deduped_results.append(item)

        deduped_results.sort(key=lambda x: 0 if x.get("image") else 1)

        self.cache[cache_key] = deduped_results

    def enrich_result(self, result, europeana_list, met_list):
        def is_match(a, b):
            return (a or "").strip().lower() == (b or "").strip().lower()

        if result.get("image"):
            return result
        
        for source_list in [europeana_list, met_list]:
            for item in source_list:
                if is_match(result.get("title"), item.get("title")) and (
                    is_match(result.get("author"), item.get("author")) or not result.get("author")
                ):
                    for field in ["image", "description", "medium", "dimensions"]:
                        if not result.get(field) and item.get(field):
                            result[field] = item[field]
                    break

        return result

    def fetch_single_art_piece(self, external_id: str):
        for key, results in self.cache.items():
            if key.endswith("|True"):
                for result in results:
                    if result.get("_id") == external_id:
                        if not result.get("museum"):
                            result["museum"] = "Private Collection"
                        if not result.get("location"):
                            result["location"] = "Unknown"
                        return result

        query = f"""
        SELECT ?item ?itemLabel ?creatorLabel ?image ?inception ?styleLabel ?museumLabel ?location ?mediumLabel ?dimensions ?description
        WHERE {{
            BIND(wd:{external_id} AS ?item)
            OPTIONAL {{ ?item rdfs:label ?itemLabel FILTER (lang(?itemLabel) = "en") }}
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
        LIMIT 1
        """
        encoded_query = quote(query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                if results:
                    res = parse_result_wikidata_full(results[0])
                    if not res.get("museum"):
                        res["museum"] = "Private Collection"
                    if not res.get("location"):
                        res["location"] = "Unknown"
                    return res
        except requests.RequestException as e:
            print(f"Error al consultar Wikidata por ID: {e}")

        return None

    def fetch_from_wikidata(self, query, limit, offset=0):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?creatorLabel ?museumLabel ?image WHERE {{
            SERVICE wikibase:mwapi {{
                bd:serviceParam wikibase:endpoint "www.wikidata.org";
                                wikibase:api "EntitySearch";
                                mwapi:search "{query}";
                                mwapi:language "en".
                ?item wikibase:apiOutputItem mwapi:item.
                ?num wikibase:apiOrdinal true.
            }}
            ?item wdt:P31 wd:Q3305213.
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wdt:P276 ?museum. }}
            OPTIONAL {{ ?item wdt:P18 ?image. }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        LIMIT {limit}
        OFFSET {offset}
        """

        encoded_query = quote(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json().get("results", {}).get("bindings", [])
        except requests.RequestException as e:
            print(f"Error al consultar Wikidata: {e}")
        return []

    def fetch_from_europeana(self, query, limit):
        url = f"https://api.europeana.eu/record/v2/search.json?wskey={self.europeana_api_key}&query={query}&rows={limit}"
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json().get("items", [])
        except requests.RequestException as e:
            print(f"Error al consultar Europeana: {e}")
        return []

    def fetch_from_met(self, query, limit):
        search_url = f"https://collectionapi.metmuseum.org/public/collection/v1/search?q={query}"
        try:
            search_response = requests.get(search_url, headers=self.headers)
            if search_response.status_code == 200:
                object_ids = search_response.json().get("objectIDs", [])[:limit]
                results = []
                for obj_id in object_ids:
                    obj_url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{obj_id}"
                    obj_response = requests.get(obj_url, headers=self.headers)
                    if obj_response.status_code == 200:
                        results.append(obj_response.json())
                return results
        except requests.RequestException as e:
            print(f"Error al consultar The Met: {e}")
        return []

    def fetch_artist_data(self, artist_name):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?itemDescription ?dateOfDeath ?sitelinks WHERE {{
        SERVICE wikibase:mwapi {{
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
                            wikibase:api "EntitySearch";
                            mwapi:search "{artist_name}";
                            mwapi:language "en".
            ?item wikibase:apiOutputItem mwapi:item.
            ?num wikibase:apiOrdinal true.
        }}
        ?item wdt:P31 wd:Q5.
        OPTIONAL {{ ?item schema:description ?itemDescription FILTER (LANG(?itemDescription) = "en") }}
        OPTIONAL {{ ?item wdt:P570 ?dateOfDeath. }}
        OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks. }}
        SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        ORDER BY DESC(?sitelinks)
        LIMIT 1
        """

        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                if results:
                    r = results[0]
                    wikidata_id = r["item"]["value"].split("/")[-1]
                    label = r.get("itemLabel", {}).get("value")
                    description = r.get("itemDescription", {}).get("value")
                    date_of_death = r.get("dateOfDeath", {}).get("value")
                    sitelinks = int(r.get("sitelinks", {}).get("value", 0))
                    return {
                        "wikidata_id": wikidata_id,
                        "label": label,
                        "description": description,
                        "date_of_death": date_of_death,
                        "sitelinks": sitelinks,
                        "wikipedia_url": f"https://en.wikipedia.org/wiki/{label.replace(' ', '_')}" if label else None,
                    }
        except requests.RequestException as e:
            print(f"Error buscando artista en Wikidata: {e}")

        return None

    def fetch_works_by_artist(self, artist_wikidata_id, limit=50):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {{
        ?item wdt:P170 wd:{artist_wikidata_id} .
        OPTIONAL {{ ?item schema:description ?itemDescription FILTER (LANG(?itemDescription) = "en") }}
        OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks }}
        SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        ORDER BY DESC(?sitelinks)
        LIMIT {limit}
        """
        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                return results
        except requests.RequestException as e:
            print(f"Error buscando obras por artista en Wikidata: {e}")
        return []
    
    def fetch_museums_nearby(self, latitude, longitude, radius_km=10):
        sparql_query = f"""
        SELECT DISTINCT ?item ?itemLabel ?coord ?lat ?lon ?dist ?image WHERE {{
        SERVICE wikibase:around {{
            ?item wdt:P625 ?coord .
            bd:serviceParam wikibase:center "Point({longitude} {latitude})"^^geo:wktLiteral .
            bd:serviceParam wikibase:radius "{radius_km}" .
            bd:serviceParam wikibase:distance ?dist .
        }}
        ?item wdt:P31/wdt:P279* wd:Q33506 .
        OPTIONAL {{ ?item wdt:P18 ?image. }}
        ?item p:P625 ?coordinate .
        ?coordinate psv:P625 ?coordinate_node .
        ?coordinate_node wikibase:geoLatitude ?lat .
        ?coordinate_node wikibase:geoLongitude ?lon .
        SERVICE wikibase:label {{ bd:serviceParam wikibase:language "es,en". }}
        }}
        ORDER BY ASC(?dist)
        """

        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                museums = []
                for r in results:
                    item_uri = r.get("item", {}).get("value", "")
                    qid = item_uri.split("/")[-1]
                    image_url = r.get("image", {}).get("value") if "image" in r else None

                    museums.append({
                        "id": qid,
                        "name": r.get("itemLabel", {}).get("value", qid),
                        "latitude": float(r.get("lat", {}).get("value", 0)),
                        "longitude": float(r.get("lon", {}).get("value", 0)),
                        "distance_km": float(r.get("dist", {}).get("value", 0)),
                        "image": image_url,
                        "url": f"https://www.wikidata.org/wiki/{qid}"
                    })
                return museums
        except requests.RequestException as e:
            print(f"Error buscando museos cercanos en Wikidata: {e}")
        return []

    def fetch_artworks_in_museum(self, museum_wikidata_id, limit=100):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?itemDescription ?sitelinks ?creatorLabel ?image WHERE {{
            ?item wdt:P31/wdt:P279* wd:Q838948 .
            ?item wdt:P276 wd:{museum_wikidata_id} .
            OPTIONAL {{ ?item schema:description ?itemDescription FILTER (LANG(?itemDescription) = "en") }}
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wdt:P18 ?image. }}
            OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        ORDER BY DESC(?sitelinks)
        LIMIT {limit}
        """
        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                return results
        except requests.RequestException as e:
            print(f"Error buscando obras en el museo en Wikidata: {e}")
        return []

    
def parse_result_wikidata(item):
    return {
        "_id": item.get("item", {}).get("value", "").split("/")[-1],
        "title": item.get("itemLabel", {}).get("value"),
        "author": item.get("creatorLabel", {}).get("value"),
        "museum": item.get("museumLabel", {}).get("value"),
        "image": item.get("image", {}).get("value"),
    }

def parse_result_wikidata_full(item):
    return {
        "_id": item.get("item", {}).get("value", "").split("/")[-1],
        "title": item.get("itemLabel", {}).get("value"),
        "author": item.get("creatorLabel", {}).get("value"),
        "museum": item.get("museumLabel", {}).get("value"),
        "image": item.get("image", {}).get("value"),
        "inception": item.get("inception", {}).get("value"),
        "style": item.get("styleLabel", {}).get("value"),
        "location": item.get("location", {}).get("value"),
        "medium": item.get("mediumLabel", {}).get("value"),
        "dimensions": item.get("dimensions", {}).get("value"),
        "description": item.get("description", {}).get("value"),
    }

def parse_result_europeana(item):
    return {
        "_id": item.get("id"),
        "title": item.get("title", [None])[0],
        "author": item.get("dcCreator", [None])[0] if item.get("dcCreator") else None,
        "image": item.get("edmIsShownBy"),
        "museum": item.get("dataProvider"),
        "description": item.get("dcDescription", [None])[0] if item.get("dcDescription") else None,
        "medium": None,
        "dimensions": None,
    }

def parse_result_met(item):
    return {
        "_id": str(item.get("objectID")),
        "title": item.get("title"),
        "author": item.get("artistDisplayName"),
        "museum": "The Met",
        "image": item.get("primaryImage"),
        "description": item.get("creditLine"),
        "medium": item.get("medium"),
        "dimensions": item.get("dimensions"),
    }
