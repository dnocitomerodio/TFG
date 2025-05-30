import requests
import threading
import os
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

class ExternalAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.europeana_api_key = os.getenv("EUROPEANA_API_KEY")
        self.cache = {}

    def fetch_art_pieces(self, query, limit=10, offset=0, expand=False):
        cache_key = f"{query.lower()}|{limit}|{offset}|{expand}"

        if expand and cache_key in self.cache:
            results = self.cache[cache_key]
        else:
            enriched_key = f"{query.lower()}|{limit}|{offset}|True"
            if not expand and enriched_key in self.cache:
                results = self.cache[enriched_key]
            else:
                base_key = f"{query.lower()}|{limit}|{offset}|False"
                if base_key in self.cache:
                    wikidata_results = self.cache[base_key]
                else:
                    wikidata_raw = self.fetch_from_wikidata(query, limit, offset)
                    wikidata_results = [parse_result_wikidata(r) for r in wikidata_raw]
                    self.cache[base_key] = wikidata_results

                if not expand:
                    threading.Thread(target=self._expand_and_cache, args=(query, limit, offset)).start()
                    results = wikidata_results
                else:
                    results = wikidata_results

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
            response = requests.get(url)
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
        SELECT ?item ?itemLabel ?creatorLabel ?image ?museumLabel (COUNT(?link) AS ?linkCount)
        WHERE {{
            ?item wdt:P31 wd:Q3305213;
                rdfs:label ?label;
                wdt:P18 ?image.  
            FILTER(CONTAINS(LCASE(?label), LCASE("{query}")) && LANG(?label) = "en")
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wdt:P276 ?museum. }}

            # Contar enlaces en Wikipedia en inglés como proxy de relevancia
            OPTIONAL {{
                ?link schema:about ?item .
                ?link schema:isPartOf <https://en.wikipedia.org/> .
            }}

            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        GROUP BY ?item ?itemLabel ?creatorLabel ?image ?museumLabel
        ORDER BY DESC(?linkCount)
        LIMIT {limit}
        OFFSET {offset}
        """
        encoded_query = quote(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json().get("results", {}).get("bindings", [])
        except requests.RequestException as e:
            print(f"Error al consultar Wikidata: {e}")
        return []



    def fetch_from_europeana(self, query, limit):
        url = f"https://api.europeana.eu/record/v2/search.json?wskey={self.europeana_api_key}&query={query}&rows={limit}"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json().get("items", [])
        except requests.RequestException as e:
            print(f"Error al consultar Europeana: {e}")
        return []

    def fetch_from_met(self, query, limit):
        search_url = f"https://collectionapi.metmuseum.org/public/collection/v1/search?q={query}"
        try:
            search_response = requests.get(search_url)
            if search_response.status_code == 200:
                object_ids = search_response.json().get("objectIDs", [])[:limit]
                results = []
                for obj_id in object_ids:
                    obj_url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{obj_id}"
                    obj_response = requests.get(obj_url)
                    if obj_response.status_code == 200:
                        results.append(obj_response.json())
                return results
        except requests.RequestException as e:
            print(f"Error al consultar The Met: {e}")
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

def parse_result_wikidata(result):
    def get_value(field):
        return result.get(field, {}).get("value")

    id_raw = get_value("item")
    wikidata_id = id_raw.split("/")[-1] if id_raw else None

    museum = get_value("museumLabel")
    if not museum:
        museum = "Private Collection"

    return {
        "_id": wikidata_id,
        "external_id": wikidata_id,
        "title": get_value("itemLabel"),
        "author": get_value("creatorLabel"),
        "museum": museum,
        "image": get_value("image"),
    }

def parse_result_wikidata_full(result):
    def get_value(field):
        return result.get(field, {}).get("value")

    location_raw = get_value("location")
    id_raw = get_value("item")
    wikidata_id = id_raw.split("/")[-1] if id_raw else None

    museum = get_value("museumLabel")
    if not museum:
        museum = "Private Collection"
        location = "Unknown"
    else:
        location = parse_location(location_raw)

    return {
        "_id": wikidata_id,
        "external_id": wikidata_id,
        "title": get_value("itemLabel"),
        "author": get_value("creatorLabel"),
        "year": get_value("inception"),
        "style": get_value("styleLabel"),
        "museum": museum,
        "location": location,
        "medium": get_value("mediumLabel"),
        "dimensions": get_value("dimensions"),
        "image": get_value("image"),
        "description": get_value("description"),
        "tags": [],
        "source_url": f"https://www.wikidata.org/wiki/{wikidata_id}" if wikidata_id else None,
        "source": "wikidata"
    }


def parse_result_europeana(item):
    image = (
        item.get("edmPreview", [None])[0] or
        item.get("edmIsShownBy") or
        item.get("edmIsShownAt")
    )
    return {
        "_id": item.get("id"),
        "external_id": item.get("id"),
        "title": item.get("title", [""])[0] if item.get("title") else None,
        "author": item.get("dcCreator", [""])[0] if item.get("dcCreator") else None,
        "year": item.get("year", [""])[0] if item.get("year") else None,
        "style": None,
        "museum": item.get("dataProvider", [""])[0] if item.get("dataProvider") else None,
        "location": {},
        "medium": None,
        "dimensions": None,
        "image": image,
        "description": item.get("dcDescription", [""])[0] if item.get("dcDescription") else None,
        "tags": [],
        "source_url": item.get("guid"),
        "source": "europeana"
    }


def parse_result_met(item):
    image = item.get("primaryImageSmall") or item.get("primaryImage")
    return {
        "_id": str(item.get("objectID")),
        "external_id": str(item.get("objectID")),
        "title": item.get("title"),
        "author": item.get("artistDisplayName"),
        "year": item.get("objectDate"),
        "style": None,
        "museum": "The Metropolitan Museum of Art",
        "location": {},
        "medium": item.get("medium"),
        "dimensions": item.get("dimensions"),
        "image": image,
        "description": item.get("creditLine"),
        "tags": [],
        "source_url": item.get("objectURL"),
        "source": "met"
    }
