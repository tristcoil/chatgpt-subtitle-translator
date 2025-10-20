import log from "loglevel"
import { CooldownContext } from "./cooldown.mjs"
import { openaiRetryWrapper } from "./openai.mjs"

/**
 * @typedef ModerationResult
 * @property {string} catergory
 * @property {number} value
 */

/**
 * @typedef ModerationServiceContext
 * @property {import("openai").OpenAI} openai
 * @property {CooldownContext} [cooler]
 */

/**
 * @param {string | string[]} input
 * @param {ModerationServiceContext} services
 * @param {import('openai').OpenAI.ModerationModel} model
 */
export async function checkModeration(input, services, model = undefined)
{
    try
    {
        return await openaiRetryWrapper(async () =>
        {
            await services.cooler?.cool()
            const moderation = await services.openai.moderations.create({ input, model })
            const moderationData = moderation.results[0]

            if (moderationData.flagged)
            {
                log.debug("[CheckModeration]", "flagged", getModeratorResults(moderationData))
            }

            return moderationData
        }, 3, "CheckModeration")
    }
    catch (error)
    {
        const message = String(error ?? "")
        // Graceful fallback when Moderations API is unavailable (e.g., OpenAI-compatible providers like Ollama)
        if (message.includes("404") || message.toLowerCase().includes("not found") || message.includes("501"))
        {
            log.warn("[CheckModeration] Moderations API unavailable, proceeding without moderation.")
            return {
                flagged: false,
                categories: /** @type {any} */ ({}),
                category_scores: /** @type {any} */ ({})
            }
        }
        throw error
    }
}

/**
 * @param {import("openai").OpenAI.Moderation} moderatorOutput
 */
export function getModeratorResults(moderatorOutput)
{
    return Object.keys(moderatorOutput.categories)
        .filter(x => moderatorOutput.categories[x])
        .map(x => ({ catergory: x, value: Number(moderatorOutput.category_scores[x]) }))
}

/**
 * @param {ModerationResult[]} moderatorResults
 */
export function getModeratorDescription(moderatorResults)
{
    return moderatorResults.map(x => `${x.catergory}: ${x.value.toFixed(3)}`).join(" ")
}
