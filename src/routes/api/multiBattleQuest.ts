import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSession, getAccountPlayers, getPlayerSync } from "../../data/wdfpData";
import { generateDataHeaders } from "../../utils";
import { getQuestFromCategorySync, getRushEventFolderClearRewards } from "../../lib/assets";
import { getCharactersEvolutionImgLevels, givePlayerCharactersExpSync } from "../../lib/character";
import { givePlayerRewardsSync, givePlayerRewardSync, givePlayerScoreRewardsSync } from "../../lib/quest";
import { BattleQuest, EquipmentItemReward, PlayerRewardResult, QuestCategory } from "../../lib/types";
import { getServerTime } from "../../utils";
import { getPlayerSingleQuestProgressSync, insertPlayerQuestProgressSync, updatePlayerQuestProgressSync, updatePlayerSync, getPlayerRushEventSync, updatePlayerRushEventSync, insertPlayerRushEventClearedFolderSync, deletePlayerRushEventPlayedPartyListSync, insertPlayerRushEventPlayedPartySync, getPlayerPartyGroupListSync } from "../../data/wdfpData";
import { RushEventBattleType, UserRushEventPlayedParty } from "../../data/types";
import { getSerializedPlayerRushEventPlayedPartiesSync } from "../../lib/rush";
import { FinishBody, ReturnRushEvent } from "./singleBattleQuest";
import { rushEventFolderMaxRounds } from "./rushEvent";
import { multiplayerState } from "../../multiplayerState";

interface GetRoomsBody {
    event_id: number,
    viewer_id: number,
    category_id: number
}

interface CreateRoomBody {
    category: number,
    party_id: number,
    quest_id: number,
    viewer_id: number
}

interface PrepareRoomBody {
    category: number,
    quest_id: number,
    room_number?: string,
    access_token?: string,
    viewer_id: number
}

interface SelectRoomBody {
    category: number,
    quest_id: number,
    party_id: number,
    accepted_type: number,
    room_number?: string,
    access_token?: string,
    viewer_id: number
}

const routes = async (fastify: FastifyInstance) => {
    fastify.post("/get_rooms", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as GetRoomsBody

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        const viewerIdSession = await getSession(viewerId.toString())
        if (!viewerIdSession) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid viewer id."
        })

        const rooms = [];
        if (multiplayerState.activeRoom.hostViewerId !== 0) {
            let hostName = "Player";
            let leaderCharacterId = 111005;

            // Fetch the real host player data
            const hostSession = await getSession(multiplayerState.activeRoom.hostViewerId.toString());
            if (hostSession) {
                const hostPlayers = await getAccountPlayers(hostSession.accountId);
                if (hostPlayers.length > 0) {
                    const hostPlayer = getPlayerSync(hostPlayers[0]);
                    if (hostPlayer) {
                        hostName = hostPlayer.name;
                        leaderCharacterId = hostPlayer.leaderCharacterId;
                    }
                }
            }

            rooms.push({
                "room_number": multiplayerState.activeRoom.roomNumber,
                "quest_id": multiplayerState.activeRoom.questId,
                "category_id": multiplayerState.activeRoom.categoryId,
                "host_entry_time": new Date().getTime(),
                "ip_address": "198.51.100.141",
                "port": 8082,
                "raising_state": 1,
                "room_sequence": 1,
                "is_pickup": false,
                "establisher_name": hostName,
                "establisher_character": leaderCharacterId,
                "establisher_character_evolution_img_level": 1,
                "establisher_follow": 0,
                "mates": multiplayerState.activeRoom.matesCount || 1
            });
        }

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({
                viewer_id: viewerId
            }),
            "data": {
                "rooms": rooms
            }   
        })
    })

    fastify.post("/create_room", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as CreateRoomBody

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        const viewerIdSession = await getSession(viewerId.toString())
        if (!viewerIdSession) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid viewer id."
        })

        // Update global multiplayer state for dummy private server
        multiplayerState.activeRoom.questId = body.quest_id;
        multiplayerState.activeRoom.categoryId = body.category;
        multiplayerState.activeRoom.hostViewerId = viewerId;

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({
                viewer_id: viewerId
            }),
            "data": {
                "access_token": "dummy_token_123",
                "room_number": "123456",
                "room_url": "ws://127.0.0.1:8080/multiplayer"
            }   
        })
    })

    fastify.post("/prepare", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as PrepareRoomBody

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({ viewer_id: viewerId }),
            "data": {}   
        })
    })

    fastify.post("/select_room", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as SelectRoomBody

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({ viewer_id: viewerId }),
            "data": {
                "application_update_url": "",
                "category_id": body.category || 2,
                "host_entry_time": new Date().getTime(),
                "ip_address": "198.51.100.141",
                "is_pickup": false,
                "port": 8082,
                "quest_id": body.quest_id || multiplayerState.activeRoom.questId,
                "raising_state": 1,
                "room_number": body.room_number || multiplayerState.activeRoom.roomNumber,
                "room_sequence": 1
            }   
        })
    })

    fastify.post("/restore_room", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any
        const viewerId = body.viewer_id

        const roomExists = multiplayerState.activeRoom.hostViewerId !== 0;

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({ viewer_id: viewerId || 0 }),
            "data": roomExists ? {
                "category_id": multiplayerState.activeRoom.categoryId,
                "quest_id": multiplayerState.activeRoom.questId,
                "room_number": multiplayerState.activeRoom.roomNumber,
                "host_entry_time": new Date().getTime(),
                "ip_address": "198.51.100.141",
                "port": 8082,
                "raising_state": 1,
                "room_sequence": 1,
                "is_pickup": false
            } : {
                "ip_address": "198.51.100.141",
                "port": 8082,
                "raising_state": 9 // Disbanded: Clears the stuck room state and returns to menu
            }   
        })
    })

    fastify.post("/disband_room", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any
        const viewerId = body.viewer_id

        // Clear the active room when disbanded
        if (multiplayerState.activeRoom.hostViewerId === viewerId) {
            multiplayerState.activeRoom.hostViewerId = 0;
        }

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({ viewer_id: viewerId || 0 }),
            "data": {}   
        })
    })

    fastify.post("/search_room", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any
        const viewerId = body.viewer_id

        const roomExists = multiplayerState.activeRoom.hostViewerId !== 0 && body.room_number === multiplayerState.activeRoom.roomNumber;

        if (!roomExists) {
            reply.header("content-type", "application/x-msgpack")
            return reply.status(200).send({
                "data_headers": generateDataHeaders({ viewer_id: viewerId || 0 }),
                "data": {
                    "room_exists": false
                }   
            })
        }

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": generateDataHeaders({ viewer_id: viewerId || 0 }),
            "data": {
                "room_exists": true,
                "establisher_follow": 0,
                "room_number": body.room_number,
                "quest_id": multiplayerState.activeRoom.questId,
                "category_id": multiplayerState.activeRoom.categoryId,
                "host_entry_time": new Date().getTime(),
                "ip_address": "198.51.100.141",
                "port": 8082,
                "raising_state": 1,
                "room_sequence": 1,
                "is_pickup": false
            }   
        })
    })

    
    fastify.post("/finish", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as FinishBody
        console.log(`[MULTI FINISH] Received finish request. viewer_id: ${body.viewer_id}, quest_id: ${body.quest_id}, category: ${body.category}`);
        console.log(`[MULTI FINISH] Body keys: ${Object.keys(body).join(', ')}`);
        console.log(`[MULTI FINISH] multiplayerState.roomMates: ${JSON.stringify(multiplayerState.roomMates.map((m: any) => ({ viewerId: m.viewerId, name: m.name, connectionId: m.connectionId, playerRoleKind: m.playerRoleKind })))}`);

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        const viewerIdSession = await getSession(viewerId.toString())
        if (!viewerIdSession) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid viewer id."
        })

        // get player
        const playerIds = await getAccountPlayers(viewerIdSession.accountId)
        const playerId = playerIds[0]
        const playerData = !isNaN(playerId) ? getPlayerSync(playerId) : null

        if (playerData === null) return reply.status(500).send({
            "error": "Internal Server Error",
            "message": "No player bound to account."
        })

        // get active quest data
        
        const activeQuestData = {
            category: body.category || multiplayerState.activeRoom.categoryId,
            questId: body.quest_id || multiplayerState.activeRoom.questId,
            useBoostPoint: false,
            useBossBoostPoint: false
        };


        // get quest data
        const questCategory = activeQuestData.category
        const questId = activeQuestData.questId
        const questData = getQuestFromCategorySync(questCategory, questId) as BattleQuest | null
        if (questData === null || !('rankPointReward' in questData)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Quest doesn't exist."
        })

        // delete the active quest data from global record
        // active room stays open for others

        // calculate clear rank
        const clearTime = body.elapsed_time_ms
        const clearRank = questData.sPlusRankTime >= clearTime ? 5
            : questData.sRankTime >= clearTime ? 4
                : questData.aRankTime >= clearTime ? 3
                    : questData.bRankTime >= clearTime ? 2
                        : 1

        // calculate player rewards
        const newExpPool = playerData.expPool + questData.poolExpReward
        const beforeRankPoint = playerData.rankPoint
        const newRankPoint = beforeRankPoint + questData.rankPointReward
        let newMana = playerData.freeMana + questData.manaReward + body.add_mana

        // calculate boost point
        let newBoostPoint = playerData.boostPoint - (activeQuestData.useBoostPoint ? 1 : 0)
        let newBossBoostPoint = playerData.bossBoostPoint - (activeQuestData.useBossBoostPoint ? 1 : 0)
        let useBoostPoint = (activeQuestData.useBoostPoint && (newBoostPoint >= 0)) || (activeQuestData.useBossBoostPoint && (newBossBoostPoint >= 0))

        // check current quest progress
        const questProgress = getPlayerSingleQuestProgressSync(playerId, questCategory, questId);
        const questPreviouslyCompleted = questProgress !== null
        const questAccomplished = body.is_accomplished

        const clearReward = !questPreviouslyCompleted && questData.clearReward !== undefined ? givePlayerRewardSync(playerId, questData.clearReward) : null
        const sPlusClearReward = (clearRank === 5) && (questProgress?.clearRank !== 5) && (questData.sPlusReward !== undefined) ? givePlayerRewardSync(playerId, questData.sPlusReward) : null
        if (questAccomplished) {
            // update quest progress
            if (questPreviouslyCompleted) {
                // simply update the quest progress if it already exists.
                updatePlayerQuestProgressSync(playerId, questCategory, {
                    questId: questId,
                    finished: true,
                    bestElapsedTimeMs: questProgress.bestElapsedTimeMs === undefined || questProgress.bestElapsedTimeMs === null ? clearTime : Math.min(clearTime, questProgress.bestElapsedTimeMs),
                    clearRank: questProgress.clearRank === undefined ? clearRank : Math.max(clearRank, questProgress.clearRank),
                    highScore: questProgress.highScore === undefined ? body.score : Math.max(body.score, questProgress.highScore)
                })
            } else {
                // insert if it doesn't already exist.
                insertPlayerQuestProgressSync(playerId, questCategory, {
                    questId: questId,
                    finished: true,
                    bestElapsedTimeMs: clearTime,
                    clearRank: clearRank,
                    highScore: body.score
                })
            }
        }

        // update player
        updatePlayerSync({
            id: playerId,
            freeMana: newMana,
            expPool: newExpPool,
            rankPoint: newRankPoint,
            boostPoint: newBoostPoint,
            bossBoostPoint: newBossBoostPoint
        })

        // reward score rewards
        const scoreRewardsResult = givePlayerScoreRewardsSync(playerId, questData.scoreRewardGroupId, questData.scoreRewardGroup, useBoostPoint)

        // reward character exp
        const bodyPartyStatistics = body.statistics.party
        const partyCharacterIds = [...bodyPartyStatistics.characters, ...bodyPartyStatistics.unison_characters]
        const partyCharacterIdsArray: number[] = []
        for (const value of partyCharacterIds.values()) {
            if (value !== null && value.id !== null) partyCharacterIdsArray.push(value.id);
        }
        const addExpAmount = questData.characterExpReward

        const rewardCharacterExpResult = givePlayerCharactersExpSync(
            playerId,
            partyCharacterIdsArray,
            addExpAmount,
            questData.fixedParty !== undefined
        )

        const dataHeaders = generateDataHeaders({
            viewer_id: viewerId
        })

        // handle event quest-specific data & rewards
        let rushEventData: ReturnRushEvent | null = null
        let rushEventRewardsResult: PlayerRewardResult | null = null

        if (questCategory === QuestCategory.RUSH_EVENT) {
            // rush event

            const rushEventId = questData.rushEventId
            const rushEventFolderId = questData.rushEventFolderId
            const rushEventRound = questData.rushEventRound

            if (rushEventFolderId !== undefined && rushEventRound !== undefined && rushEventId !== undefined) {
                // update rush event data
                const rushEventBattleType = rushEventRound === 0 ? RushEventBattleType.ENDLESS : RushEventBattleType.FOLDER

                // map character ids
                const characterIds = bodyPartyStatistics.characters.map(val => val?.id ?? null)
                const unisonCharacterIds = bodyPartyStatistics.unison_characters.map(val => val?.id ?? null)

                // get evolution image levels
                const evolutionImgLevels: (number | null)[] = getCharactersEvolutionImgLevels(playerId, characterIds)
                const unisonEvolutionImgLevels: (number | null)[] = getCharactersEvolutionImgLevels(playerId, unisonCharacterIds)

                let round: number = questId

                // update endless battle stats
                if (rushEventBattleType === RushEventBattleType.ENDLESS) {
                    // get player rush event data
                    const playerRushEventData = getPlayerRushEventSync(playerId, rushEventId)

                    const playerNextRound = playerRushEventData?.endlessBattleNextRound ?? 1
                    const playerMaxRound = playerRushEventData?.endlessBattleMaxRound ?? 1
                    const playerBestClearTime = playerRushEventData?.endlessBattleMaxRoundTime ?? Number.MAX_SAFE_INTEGER
                    round = playerNextRound

                    if ((playerNextRound >= playerMaxRound && playerBestClearTime >= clearTime) || (playerNextRound > playerMaxRound)) {
                        updatePlayerRushEventSync(playerId, {
                            eventId: rushEventId,
                            endlessBattleMaxRound: playerNextRound,
                            endlessBattleMaxRoundTime: clearTime,
                            endlessBattleMaxRoundCharacterIds: characterIds,
                            endlessBattleMaxRoundCharacterEvolutionImgLvls: evolutionImgLevels
                        })
                    }
                    
                } else if (rushEventBattleType === RushEventBattleType.FOLDER && (rushEventRound >= (rushEventFolderMaxRounds[rushEventFolderId] ?? 0))) {
                    // mark folder as complete since this is the final round
                    insertPlayerRushEventClearedFolderSync(playerId, rushEventId, rushEventFolderId)
                    // update the active folder value
                    updatePlayerRushEventSync(playerId, {
                        eventId: rushEventId,
                        activeRushBattleFolderId: null
                    })
                    // delete played parties
                    deletePlayerRushEventPlayedPartyListSync(playerId, rushEventId, rushEventBattleType)
                }

                // insert played party
                insertPlayerRushEventPlayedPartySync(playerId, rushEventId, {
                    characterIds: characterIds,
                    unisonCharacterIds: unisonCharacterIds,
                    equipmentIds: bodyPartyStatistics.equipments.map(val => val?.id ?? null),
                    abilitySoulIds: bodyPartyStatistics.ability_soul_ids,
                    evolutionImgLevels: evolutionImgLevels,
                    unisonEvolutionImgLevels: unisonEvolutionImgLevels,
                    battleType: rushEventBattleType,
                    round: round
                })

                // get serialized parties
                const serializedPlayedParties = getSerializedPlayerRushEventPlayedPartiesSync(playerId, rushEventId)

                // set rush event data
                rushEventData = {
                    "rush_battle_reward_list": [],
                    "rush_battle_played_party_list": serializedPlayedParties.folderParties,
                    "endless_battle_played_party_list": serializedPlayedParties.endlessParties,
                    "is_out_of_period": false
                }

                // give rewards if allowed
                if (rushEventRound >= (rushEventFolderMaxRounds[rushEventFolderId] ?? 0)) {
                    const rewards = getRushEventFolderClearRewards(rushEventId, rushEventFolderId) ?? []
                    rushEventRewardsResult = givePlayerRewardsSync(playerId, rewards)

                    rushEventData.rush_battle_reward_list = rewards.map(reward => {
                        const itemReward = reward as EquipmentItemReward
                        return {
                            "kind": 1,
                            "kind_id": itemReward.id,
                            "number": itemReward.count
                        }
                    })
                }
            }
        }

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": dataHeaders,
            "data": {
                "user_info": {
                    "free_mana": newMana + (clearReward?.user_info.free_mana || 0) + (sPlusClearReward?.user_info.free_mana || 0) + scoreRewardsResult.user_info.free_mana,
                    "exp_pool": rewardCharacterExpResult.exp_pool + (clearReward?.user_info.exp_pool || 0) + scoreRewardsResult.user_info.exp_pool,
                    "exp_pooled_time": getServerTime(playerData.expPooledTime),
                    "free_vmoney": playerData.freeVmoney + (clearReward?.user_info.free_vmoney || 0) + (sPlusClearReward?.user_info.free_vmoney || 0) + scoreRewardsResult.user_info.free_vmoney,
                    "rank_point": newRankPoint,
                    "stamina": playerData.stamina,
                    "stamina_heal_time": getServerTime(playerData.staminaHealTime),
                    "boost_point": newBoostPoint,
                    "boss_boost_point": newBossBoostPoint
                },
                "add_exp_list": rewardCharacterExpResult.add_exp_list,
                "character_list": [
                    ...rewardCharacterExpResult.character_list,
                    ...(clearReward?.character_list || []),
                    ...(sPlusClearReward?.character_list || []),
                    ...scoreRewardsResult.character_list
                ],
                "bond_token_status_list": rewardCharacterExpResult.bond_token_status_list,
                "rewards": {
                    "overflow_pool_exp": 0,
                    "converted_pool_exp": 0,
                    "reward_pool_exp": questData.poolExpReward,
                    "reward_mana": questData.manaReward,
                    "field_mana": body.add_mana
                },
                "old_high_score": questProgress === null ? 0 : questProgress.highScore || 0,
                "joined_character_id_list": [
                    ...(clearReward?.joined_character_id_list || []),
                    ...(sPlusClearReward?.joined_character_id_list || []),
                    ...scoreRewardsResult.joined_character_id_list
                ],
                "before_rank_point": beforeRankPoint,
                "clear_rank": clearRank,
                "drop_score_reward_ids": scoreRewardsResult.drop_score_reward_ids,
                "drop_rare_reward_ids": scoreRewardsResult.drop_rare_reward_ids,
                "drop_additional_reward_ids": [],
                "drop_periodic_reward_ids": [],
                "equipment_list": scoreRewardsResult.equipment_list,
                "category_id": questCategory,
                "start_time": dataHeaders['servertime'],
                "is_multi": "multi",
                "quest_name": "",
                "item_list": {
                    ...scoreRewardsResult.items,
                    ...(rushEventRewardsResult?.items ?? {})
                },
                "rush_event": rushEventData,
                "host_finished": true,
                "party_info": (() => {
                    const partyGroups = getPlayerPartyGroupListSync(playerId);
                    const firstGroupKey = Object.keys(partyGroups)[0];
                    const group = firstGroupKey ? partyGroups[firstGroupKey] : null;
                    const firstPartyKey = group ? Object.keys(group.list)[0] : null;
                    const party = firstPartyKey ? (group!.list as any)[firstPartyKey] : null;
                    return party ? {
                        "party_id": parseInt(firstPartyKey!) || 1,
                        "party_name": party.name || "",
                        "party_edited": party.edited || false,
                        "character_ids": party.characterIds.map((id: number | null) => id || null),
                        "unison_character_ids": party.unisonCharacterIds.map((id: number | null) => id || null),
                        "equipment_ids": party.equipmentIds.map((id: number | null) => id || null),
                        "ability_soul_ids": party.abilitySoulIds.map((id: number | null) => id || null),
                        "options": { "allow_other_players_to_heal_me": party.options?.allowOtherPlayersToHealMe ?? true }
                    } : {
                        "party_id": 1,
                        "party_name": "",
                        "party_edited": false,
                        "character_ids": [null, null, null],
                        "unison_character_ids": [null, null, null],
                        "equipment_ids": [null, null, null],
                        "ability_soul_ids": [null, null, null],
                        "options": { "allow_other_players_to_heal_me": true }
                    };
                })(),
                "follow_info": (() => {
                    // Use lastBattleRoomMates (snapshot from battle start) because
                    // live roomMates gets cleared when TCP sockets disconnect before
                    // the HTTP finish endpoint is called
                    const allMates = multiplayerState.lastBattleRoomMates;
                    console.log(`[FINISH] Building follow_info. lastBattleRoomMates count: ${allMates.length}, requesting viewerId: ${viewerId}`);
                    console.log(`[FINISH] roomMates viewerIds: ${allMates.map((m: any) => m.viewerId).join(', ')}`);
                    
                    if (allMates.length <= 1) return null;
                    
                    // Return all mates except self - but if all share the same viewerId,
                    // return all mates except the first match (to keep at least some entries)
                    let otherMates = allMates.filter((m: any) => m.viewerId !== viewerId);
                    if (otherMates.length === 0) {
                        // All share the same viewerId - return all except one (self)
                        otherMates = allMates.slice(1);
                        console.log(`[FINISH] All mates share same viewerId. Using ${otherMates.length} mates.`);
                    }
                    
                    const result = otherMates.map((mate: any) => ({
                        "viewer_id": mate.viewerId,
                        "name": mate.name || "Player",
                        "last_login_time": Math.floor(Date.now() / 1000),
                        "rank": mate.playerRank || 1,
                        "comment": "",
                        "role": mate.playerRoleKind || 2,
                        "degree_id": mate.degreeId || 0,
                        "leader_character_id": mate.leaderCharacterId || (mate.party?.characters?.[0]?.[1]?.id ?? 0),
                        "leader_character_evolution_img_level": mate.leaderCharacterEvolutionLevel || 1,
                        "follow_state": 0,
                        "follow_time": null,
                        "followed_time": null,
                        "profile_image_url": null,
                        "kakao_pid": ""
                    }));
                    console.log(`[FINISH] follow_info entries: ${result.length}`);
                    return result;
                })(),
                "presigned_url": null,
                "carnival_event": null,
                "raid_event": null,
                "ranking_event": null,
                "score_attack_event": null,
                "solo_time_attack_event": null,
                "drawn_quest": null,
                "unfinished_play_id": null,
                "aborted_play_id": null,
                "user_notice_list": [],
                "user_periodic_reward_point_list": []
            }
        })
    })


    fastify.post("/start", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any
        const viewerId = body.viewer_id

        const dataHeaders = generateDataHeaders({
            viewer_id: viewerId || 0
        })

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": dataHeaders,
            "data": {
                "play_id": body.play_id || "4EEF8A6B-F523-413D-E211-69FA54FB70327704",
                "time": Math.floor(Date.now() / 1000),
                "follow_bonus_info": null,
                "client_checks": [],
                "user_info": {
                    "last_main_quest_id": body.quest_id || multiplayerState.activeRoom.questId
                },
                "category_id": body.category || 2,
                "is_multi": "multi",
                "start_time": dataHeaders['servertime'],
                "quest_name": ""
            }   
        })
    })

    fastify.post("/abort", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any

        const viewerId = body.viewer_id
        if (!viewerId || isNaN(viewerId)) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid request body."
        })

        const viewerIdSession = await getSession(viewerId.toString())
        if (!viewerIdSession) return reply.status(400).send({
            "error": "Bad Request",
            "message": "Invalid viewer id."
        })

        // get player
        const playerIds = await getAccountPlayers(viewerIdSession.accountId)
        const playerId = playerIds[0]

        if (isNaN(playerId)) return reply.status(500).send({
            "error": "Internal Server Error",
            "message": "No player bound to account."
        })

        const headers = generateDataHeaders({ viewer_id: viewerId })

        reply.header("content-type", "application/x-msgpack")
        return reply.status(200).send({
            "data_headers": headers,
            "data": {
                "user_info": {},
                "category_id": body.category || multiplayerState.activeRoom.categoryId,
                "is_multi": "multi",
                "start_time": headers['servertime'],
                "quest_name": ""
            }
        })
    })
}

export default routes;
