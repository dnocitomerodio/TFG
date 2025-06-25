import requests
import os
import math
import logging
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv
from urllib.parse import quote, quote_plus
from app.services.logger_service import log_user_action

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

class ExternalAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.europeana_api_key = os.getenv("EUROPEANA_API_KEY")
        self.cache = {}
        self.headers = {
            "User-Agent": "Musaica ArtExplorer/1.0 (musaicanotificaciones@proton.me)"
        }
        self.client = ChatCompletionsClient(
            endpoint=os.getenv("AI_URL"),
            credential=AzureKeyCredential(os.getenv("AI_KEY")),
        )
        self.ai_model = os.getenv("AI_MODEL")

    def fetch_art_pieces(self, query, limit=10, offset=0, expand=False):
        wikidata_raw = self.fetch_from_wikidata(query, limit, offset)
        results = [parse_result_wikidata(r) for r in wikidata_raw if r.get("item", {}).get("value")]

        seen = set()
        deduped_results = []
        for item in results:
            key = (
                (item.get("title") or "").strip().lower(),
                (item.get("author") or "").strip().lower()
            )
            if key not in seen and item.get("external_id"):
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
    
    def generate_artwork_description(self, title, author, base_description, user_level):
        if user_level == "none":
            return base_description
        
        if user_level == "beginner":
            user_token = 500
        elif user_level == "intermediate":
            user_token = 700
        elif user_level == "expert":
            user_token = 900

        level_instruction = {
            "beginner": "Use simple and accessible language, as if explaining to someone with no background in art.",
            "expert": "Include technical and historical insights appropriate for someone with an advanced understanding of art.",
            "intermediate": "Expand and enrich the description in a clear and engaging way without oversimplifying or going too technical."
        }

        instruction = level_instruction.get(user_level, level_instruction["intermediate"])

        prompt = (
            f"{instruction}\n"
            "Write a natural, flowing paragraph with no sections, titles, formatting, or bullet points.\n\n"
            f"Title: {title}\n"
            f"Author: {author}\n"
            f"Description: {base_description}"
        )

        try:
            completion = self.client.complete(
                messages=[
                    SystemMessage("You are an art expert who writes fluid, natural explanations in paragraph form, without formatting or structure."),
                    UserMessage(prompt),
                ],
                model=self.ai_model,
                temperature=0.9,
                top_p=0.95,
                max_tokens=user_token
            )
            return completion.choices[0].message.content
        except Exception as e:
            logger.error("Error generating enriched description for %s by %s: %s", title, author, str(e))
            return base_description


    def fetch_single_art_piece(self, external_id: str, user_level="none"):
        external_id = external_id.strip()
        for key, results in self.cache.items():
            if key.endswith("|True"):
                for result in results:
                    if result.get("external_id") == external_id:
                        if not result.get("museum"):
                            result["museum"] = "Private Collection"
                        if not result.get("location"):
                            result["location"] = "Unknown"
                        return result

        query = f"""
        SELECT ?item ?itemLabel ?creatorLabel ?image ?relatedImage ?inception ?styleLabel ?museumLabel ?location ?mediumLabel ?dimensions ?description
        WHERE {{
            BIND(wd:{external_id} AS ?item)
            OPTIONAL {{ ?item rdfs:label ?itemLabel FILTER (lang(?itemLabel) = "en") }}
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wdt:P18 ?image. }}
            OPTIONAL {{ ?item wdt:P6802 ?relatedImage. }}
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
            logger.debug("Wikidata query for %s: %s", external_id, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata response for %s: %s", external_id, results)
                if results:
                    res = parse_result_wikidata_full(results[0])
                    if not res.get("museum"):
                        res["museum"] = "Private Collection"
                    if not res.get("location"):
                        res["location"] = "Unknown"
                    if res.get("description"):
                        try:
                            enriched = self.generate_artwork_description(
                                title=res.get("title", ""),
                                author=res.get("author", ""),
                                base_description=res["description"],
                                user_level=user_level
                            )
                            res["description"] = enriched
                        except Exception as e:
                            logger.error("Error generating enriched description for %s: %s", external_id, str(e))
                    return res
                else:
                    logger.debug("No data found for artwork %s", external_id)
                    return {}
            else:
                logger.error("Error fetching artwork %s: HTTP %d", external_id, response.status_code)
                return {}
        except requests.RequestException as e:
            logger.error("Error querying Wikidata for %s: %s", external_id, str(e))
            return {}

    def fetch_from_wikidata(self, query, limit, offset=0):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?creatorLabel ?museumLabel ?image ?relatedImage WHERE {{
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
            OPTIONAL {{ ?item wdt:P6802 ?relatedImage. }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        LIMIT {limit}
        OFFSET {offset}
        """

        encoded_query = quote(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            logger.debug("Wikidata query for %s: %s", query, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata response for %s: %s results", query, len(results))
                return results
            else:
                logger.error("Error querying Wikidata for %s: HTTP %d", query, response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying Wikidata for %s: %s", query, str(e))
            return []

    def fetch_from_europeana(self, query, limit):
        url = f"https://api.europeana.eu/record/v2/search.json?wskey={self.europeana_api_key}&query={query}&rows={limit}"
        try:
            response = requests.get(url, headers=self.headers)
            logger.debug("Europeana query for %s: %s", query, url)
            if response.status_code == 200:
                results = response.json().get("items", [])
                logger.debug("Europeana response for %s: %s results", query, len(results))
                return results
            else:
                logger.error("Error querying Europeana for %s: HTTP %d", query, response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying Europeana for %s: %s", query, str(e))
            return []

    def fetch_from_met(self, query, limit):
        search_url = f"https://collectionapi.metmuseum.org/public/collection/v1/search?q={query}"
        try:
            search_response = requests.get(search_url, headers=self.headers)
            logger.debug("Met Museum search query for %s: %s", query, search_url)
            if search_response.status_code == 200:
                object_ids = search_response.json().get("objectIDs", [])[:limit]
                logger.debug("Met Museum search returned %s object IDs", len(object_ids))
                results = []
                for obj_id in object_ids:
                    obj_url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{obj_id}"
                    obj_response = requests.get(obj_url, headers=self.headers)
                    if obj_response.status_code == 200:
                        results.append(obj_response.json())
                    else:
                        logger.error("Error fetching Met object %s: HTTP %d", obj_id, obj_response.status_code)
                logger.debug("Met Museum fetched %s objects", len(results))
                return results
            else:
                logger.error("Error querying Met Museum for %s: HTTP %d", query, search_response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying Met Museum for %s: %s", query, str(e))
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
            logger.debug("Wikidata artist query for %s: %s", artist_name, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata artist response for %s: %s results", artist_name, len(results))
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
                else:
                    logger.debug("No artist data found for %s", artist_name)
                    return None
            else:
                logger.error("Error querying artist %s: HTTP %d", artist_name, response.status_code)
                return None
        except requests.RequestException as e:
            logger.error("Error querying artist %s: %s", artist_name, str(e))
            return None

    def fetch_works_by_artist(self, artist_wikidata_id, limit=50, offset=0):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?itemDescription ?museumLabel ?sitelinks ?image ?relatedImage ?creatorLabel WHERE {{
            ?item wdt:P170 wd:{artist_wikidata_id} .
            OPTIONAL {{ ?item schema:description ?itemDescription FILTER (LANG(?itemDescription) = "en") }}
            OPTIONAL {{ ?item wdt:P18 ?image. }}
            OPTIONAL {{ ?item wdt:P6802 ?relatedImage. }}
            OPTIONAL {{ ?item wdt:P276 ?museum. }}
            OPTIONAL {{ ?item wdt:P170 ?creator. }}
            OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        ORDER BY DESC(?sitelinks)
        LIMIT {limit}
        OFFSET {offset}
        """
        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            logger.debug("Wikidata works query for artist %s: %s", artist_wikidata_id, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata works response for artist %s: %s results", artist_wikidata_id, len(results))
                return [parse_result_wikidata(r) for r in results if r.get("item", {}).get("value")]
            else:
                logger.error("Error querying works for artist %s: HTTP %d", artist_wikidata_id, response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying works for artist %s: %s", artist_wikidata_id, str(e))
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
            logger.debug("Wikidata museums query for (%s, %s): %s", latitude, longitude, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata museums response for (%s, %s): %s results", latitude, longitude, len(results))
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
            else:
                logger.error("Error querying museums near (%s, %s): HTTP %d", latitude, longitude, response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying museums near (%s, %s): %s", latitude, longitude, str(e))
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
            logger.debug("Wikidata artworks query for museum %s: %s", museum_wikidata_id, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata artworks response for museum %s: %s results", museum_wikidata_id, len(results))
                return results
            else:
                logger.error("Error querying artworks in museum %s: HTTP %d", museum_wikidata_id, response.status_code)
                return []
        except requests.RequestException as e:
            logger.error("Error querying artworks in museum %s: %s", museum_wikidata_id, str(e))
            return []

    def fetch_recommendations_from_wikidata(self, favorites, level, offset=0):
        if not favorites or offset < 0:
            logger.debug("Returning empty list: no favorites or negative offset")
            return []

        if offset > 100:
            logger.warning("Large offset (%d) may slow down query performance", offset)

        results = []
        for favorite in favorites:
            sparql_query = f"""
            SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?description ?image ?relatedImage ?museumLabel (SAMPLE(?styleLabel) AS ?styleLabel) ?sitelinks
            WHERE {{
              {{
                ?item wdt:P170 wd:Q5593 .
              }} UNION {{
                ?item wdt:P135 ?style .
                wd:{favorite} wdt:P135 ?style .
              }} UNION {{
                ?item wdt:P195 wd:Q460889 .
              }}
              ?item wdt:P31 wd:Q3305213 .
              ?item wdt:P170 ?creator .
              ?item wdt:P195 ?museum .
              FILTER (?item != wd:{favorite})
              OPTIONAL {{
                VALUES ?styleProp {{ wdt:P135 wdt:P136 }}
                ?item ?styleProp ?style .
                ?style rdfs:label ?styleLabel . FILTER(LANG(?styleLabel) = "en")
              }}
              OPTIONAL {{ ?item wdt:P18 ?image . }}
              OPTIONAL {{ ?item wdt:P6802 ?relatedImage . }}
              OPTIONAL {{ ?item schema:description ?description . FILTER(LANG(?description) = "en") }}
              OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks . }}
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". 
                ?item rdfs:label ?itemLabel .
                ?creator rdfs:label ?creatorLabel .
                ?museum rdfs:label ?museumLabel .
              }}
            }}
            GROUP BY ?item ?itemLabel ?creatorLabel ?description ?image ?relatedImage ?museumLabel ?sitelinks
            ORDER BY DESC(?sitelinks)
            LIMIT 50
            """
            encoded_query = quote_plus(sparql_query)
            url = f"{self.base_url}?query={encoded_query}&format=json"

            try:
                response = requests.get(url, headers=self.headers)
                logger.debug("Wikidata recommendations query for favorite %s: %s", favorite, url)
                if response.status_code == 200:
                    query_results = response.json().get("results", {}).get("bindings", [])
                    logger.debug("Query for favorite %s returned %s results", favorite, len(query_results))
                    results.extend(query_results)
                else:
                    logger.error("Error querying recommendations for favorite %s: HTTP %d", favorite, response.status_code)
            except requests.RequestException as e:
                logger.error("Error fetching recommendations for favorite %s: %s", favorite, str(e))

        logger.debug("Total raw results: %s", len(results))
        return results
    
    def is_artwork_nearby(self, external_id, latitude, longitude, radius_km=10):
        sparql_query = f"""
        SELECT ?item ?itemLabel ?lat ?lon WHERE {{
            BIND(wd:{external_id} AS ?item)
            {{
                ?item wdt:P625 ?coord .
            }}
            UNION
            {{
                ?item wdt:P276 ?place .
                ?place wdt:P625 ?coord .
            }}
            UNION
            {{
                ?item wdt:P195 ?place .
                ?place wdt:P625 ?coord .
            }}
            SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,es". }}
            BIND(geof:latitude(?coord) AS ?lat)
            BIND(geof:longitude(?coord) AS ?lon)
        }}
        LIMIT 1
        """
        encoded_query = quote_plus(sparql_query)
        url = f"{self.base_url}?query={encoded_query}&format=json"

        try:
            response = requests.get(url, headers=self.headers)
            logger.debug("Wikidata query for %s: %s", external_id, url)
            if response.status_code == 200:
                results = response.json().get("results", {}).get("bindings", [])
                logger.debug("Wikidata response for %s: %s", external_id, results)
                if results:
                    lat = float(results[0].get("lat", {}).get("value"))
                    lon = float(results[0].get("lon", {}).get("value"))
                    item_label = results[0].get("itemLabel", {}).get("value", "Unknown")
                    logger.debug("Coordinates for %s (%s): lat=%s, lon=%s", external_id, item_label, lat, lon)
                    
                    distance = self.haversine_distance(latitude, longitude, lat, lon)
                    logger.debug("Distance for %s: %.2f km (radius: %.2f km)", external_id, distance, radius_km)
                    
                    is_nearby = distance <= radius_km
                    logger.debug("Artwork %s is %s at %.2f km", external_id, "nearby" if is_nearby else "too far", distance)
                    return {
                        "is_nearby": is_nearby,
                        "latitude": lat if is_nearby else None,
                        "longitude": lon if is_nearby else None
                    }
                else:
                    logger.debug("No coordinates found for artwork %s", external_id)
                    return {"is_nearby": False, "latitude": None, "longitude": None}
            else:
                logger.error("Error fetching artwork %s: HTTP %d", external_id, response.status_code)
                return {"is_nearby": False, "latitude": None, "longitude": None}
        except requests.RequestException as e:
            logger.error("Error querying Wikidata for artwork %s: %s", external_id, str(e))
            return {"is_nearby": False, "latitude": None, "longitude": None}
    
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        R = 6371
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.asin(math.sqrt(a))
        return R * c

def parse_result_wikidata(item):
    title = item.get("itemLabel", {}).get("value", "")
    artist = clean_field(item.get("creatorLabel", {}).get("value", ""))
    image = fetch_image_with_google_cse(
        item.get("image", {}).get("value", ""),
        item.get("relatedImage", {}).get("value", ""),
        title=title,
        artist=artist
    )
    return {
        "external_id": item.get("item", {}).get("value", "").split("/")[-1],
        "title": title,
        "author": artist,
        "museum": clean_field(item.get("museumLabel", {}).get("value", "")),
        "image": image,
    }

def parse_result_wikidata_full(item):
    title = item.get("itemLabel", {}).get("value", "")
    artist = clean_field(item.get("creatorLabel", {}).get("value", ""))
    return {
        "external_id": item.get("item", {}).get("value", "").split("/")[-1],
        "title": title,
        "author": artist,
        "museum": clean_field(item.get("museumLabel", {}).get("value", "")),
        "image": fetch_image_with_google_cse(
            item.get("image", {}).get("value", ""),
            item.get("relatedImage", {}).get("value", ""),
            title=title,
            artist=artist
        ),
        "inception": item.get("inception", {}).get("value", ""),
        "style": item.get("styleLabel", {}).get("value", ""),
        "location": item.get("location", {}).get("value", ""),
        "medium": item.get("mediumLabel", {}).get("value", ""),
        "dimensions": item.get("dimensions", {}).get("value", ""),
        "description": item.get("description", {}).get("value", ""),
    }

def parse_result_europeana(item):
    return {
        "external_id": item.get("id"),
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
        "external_id": str(item.get("objectID")),
        "title": item.get("title"),
        "author": item.get("artistDisplayName"),
        "museum": "The Met",
        "image": item.get("primaryImage"),
        "description": item.get("creditLine"),
        "medium": item.get("medium"),
        "dimensions": item.get("dimensions"),
    }

def clean_field(value):
    if isinstance(value, str) and (value.startswith("http://") or value.startswith("https://")):
        return "Unknown"
    return value

def fetch_image_with_google_cse(image, related_image=None, title=None, artist=None):
    img = image or related_image or ""
    if img.startswith("commons:"):
        img = f"https://commons.wikimedia.org/wiki/File:{img.replace('commons:', '')}"
    if img:
        logger.debug("Using existing image: %s", img)
        return img

    if title and artist:
        cse_id = os.getenv("GOOGLE_CSE_ID")
        api_key = os.getenv("GOOGLE_API_KEY")
        if not cse_id or not api_key:
            logger.debug("Google CSE credentials missing; using placeholder")
            return "https://via.placeholder.com/200x200.png?text=No+Image"

        query = f"{title} {artist} site:en.wikipedia.org"
        url = f"https://www.googleapis.com/customsearch/v1?key={api_key}&cx={cse_id}&q={quote(query)}&searchType=image&num=1&safe=active"

        try:
            response = requests.get(url, headers={"User-Agent": "Musaica ArtExplorer/1.0"})
            response.raise_for_status()
            results = response.json().get("items", [])
            if results and "link" in results[0]:
                logger.debug("Found image via Google CSE for query: %s, link: %s", query, results[0]["link"])
                return results[0]["link"]
            logger.debug("No image found via Google CSE for query: %s", query)
        except requests.HTTPError as e:
            logger.error("Google CSE API HTTP error for query %s: %s", query, str(e))
        except requests.RequestException as e:
            logger.error("Google CSE API request error for query %s: %s", query, str(e))
        except ValueError as e:
            logger.error("Invalid Google CSE response for query %s: %s", query, str(e))

        logger.debug("Using placeholder for title=%s, artist=%s", title, artist)
    return "https://picsum.photos/300/200.jpg"