import { getTheoryFromIndex, isMainTheory } from "../Utils/helpers";
import jsonData from "../Data/data.json" with { type: "json" };

// Updates the cache
export function setCache(query: SimQuery, response: SimResponse) {
    if (query.queryType === "all") {
        const queryJson = JSON.stringify(query);
        const responseJson = JSON.stringify(response);
        localStorage.setItem("cacheQuery", queryJson);
        localStorage.setItem("cacheResponse", responseJson);
    }    
}

// If any of these settings change, the whole cache is invalidated
function didSettingsChange(settings1: Settings, settings2: Settings) {
    return settings1.dt !== settings2.dt
    || settings1.ddt !== settings2.ddt
    || settings1.boughtVarsDelta !== settings2.boughtVarsDelta
    || settings1.simAllStrats !== settings2.simAllStrats
    || settings1.totalPurchaseList !== settings2.totalPurchaseList
}

function cacheFilterQueryAll(query: SimAllQuery): SimAllQuery {
    const cachedQueryJson = localStorage.getItem("cacheQuery");
    if (cachedQueryJson === null) {
        return query;
    }
    const cachedQuery: SimAllQuery = JSON.parse(cachedQueryJson);
    if (didSettingsChange(query.settings, cachedQuery.settings)
        || query.semiIdle !== cachedQuery.semiIdle
        || query.veryActive !== cachedQuery.veryActive) {
        return query;
    }
    query.values = query.values.map((val, i) => {
        const theory = getTheoryFromIndex(i);
        if (isMainTheory(theory) && query.sigma !== cachedQuery.sigma) { return val; }
        if (theory === "EF" && query.settings.showA23 !== cachedQuery.settings.showA23) { return val; }
        if (theory === "MF" && query.settings.mfResetDepth !== cachedQuery.settings.mfResetDepth) { return val; }
        if (val == cachedQuery.values[i]) { return -5; }
        return val;
    })

    return query;
}

export function cacheFilterQuery(query: SimQuery): SimQuery {
    if (query.queryType === "all") {
        return cacheFilterQueryAll(query);    
    }
    return query;
}

function cacheFilterResponseAll(query: SimAllQuery, response: SimAllResponse): SimAllResponse {
    const cachedResponseJson = localStorage.getItem("cacheResponse");
    if (cachedResponseJson === null) {
        return response;
    }

    const cachedResponse: SimAllResponse = JSON.parse(cachedResponseJson);

    let resultsIterator = response.results[Symbol.iterator]();
    let cachedResultsIterator = cachedResponse.results[Symbol.iterator]();

    let currentResult = resultsIterator.next();
    let currentCachedResult = cachedResultsIterator.next();

    let generatedResults: simAllResult[] = [];
    for (let i = 0; i < query.values.length; i++) {
        const theory = getTheoryFromIndex(i);
        // Case 1: Theory is present in the result and in the cache
        if (currentResult.value !== undefined && currentResult.value.theory === theory
            && currentCachedResult.value !== undefined && currentCachedResult.value.theory === theory
        ) {
            generatedResults.push(currentResult.value);
            currentResult = resultsIterator.next();
            currentCachedResult = cachedResultsIterator.next();
        }
        // Case 2: Theory is present in the result but not in the cache
        else if (currentResult.value !== undefined && currentResult.value.theory === theory
            && (currentCachedResult.value === undefined || (currentCachedResult.value !== undefined && currentCachedResult.value.theory !== theory))
        ) {
            generatedResults.push(currentResult.value);
            currentResult = resultsIterator.next();
        }
        // Case 3: Theory is not present in the result but present in the cache
        else if ((currentResult.value === undefined || (currentResult.value !== undefined && currentResult.value.theory !== theory))
            && currentCachedResult.value !== undefined && currentCachedResult.value.theory === theory
        )
        {
            if (query.values[i] === -5) {
                generatedResults.push(currentCachedResult.value);
            }
            currentCachedResult = cachedResultsIterator.next();
        }
        // If the theory is not present in either results, no action is taken
    }
    
    response.results = generatedResults;

    return response;
}

export function cacheFilterResponse(query: SimQuery, response: SimResponse): SimResponse {
    if (query.queryType === "all" && response.responseType === "all") {
        return cacheFilterResponseAll(query, response);    
    }
    return response;
}