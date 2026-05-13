import Fastify, { FastifyRequest } from "fastify";
import { ContentTypeParserDoneFunction } from "fastify/types/content-type-parser";
import fastifyStatic from "@fastify/static";
import { pack, unpack } from "msgpackr";
import path from "path";
import net from "net";
import fs from "fs";
// api routes
import apiPlugin from "./routes/api";
import assetApiPlugin from "./routes/api/asset";
import { multiplayerState } from "./multiplayerState";
import toolApiPlugin from "./routes/api/tool";
import reproduceApiPlugin from "./routes/api/reproduce"
import tutorialApiPlugin from "./routes/api/tutorial"
import gachaApiPlugin from "./routes/api/gacha"
import partyApiPlugin from "./routes/api/party"
import expodApiPlugin from "./routes/api/expod"
import storyQuestApiPlugin from "./routes/api/storyQuest"
import questApiPlugin from "./routes/api/quest"
import optionApiPlugin from "./routes/api/option"
import singleBattleQuestApiPlugin from "./routes/api/singleBattleQuest"
import multiBattleQuestApiPlugin from "./routes/api/multiBattleQuest"
import attentionApiPlugin from "./routes/api/attention"
import characterApiPlugin from "./routes/api/character"
import partyGroupApiPlugin from "./routes/api/partyGroup"
import equipmentApiPlugin from "./routes/api/equipment"
import exBoostApiPlugin from "./routes/api/exBoost"
import boxGachaApiPlugin from "./routes/api/boxGacha"
import shopApiPlugin from "./routes/api/shop"
import encyclopediaApiPlugin from "./routes/api/encyclopedia"
import mailApiPlugin from "./routes/api/mail"
import rankingEventApiPlugin from "./routes/api/rankingEvent"
import missionApiPlugin from "./routes/api/mission"
import paymentApiPlugin from "./routes/api/payment"
import newsApiPlugin from "./routes/api/news"
import raidEventApiPlugin from "./routes/api/raidEvent"
import rushEventApiPlugin from "./routes/api/rushEvent"
// web routes
import indexWebPlugin from "./routes/web"
// web api routes
import indexWebApiPlugin from "./routes/web_api"
// misc routes
import openapiPlugin from "./routes/openapi";
import infodeskPlugin from "./routes/infodesk";

// gc-openapi-zinny3.kakaogames.com
// gc-infodesk-zinny3.kakaogames.com
// na.wdfp.kakaogames.com

// initialize server
const fastify = Fastify({
    logger: false
})

// serializers
fastify.addHook('onSend', (_, reply, payload, done) => {
    try {
        switch (reply.getHeader('content-type')) {
            case "application/x-msgpack": {
                done(null, pack(payload).toString('base64'))
                break;
            }
            default:
                done(null, payload)
        }
    } catch (error) {
        done(null, payload)
    }

})

// content-type parsers
function jsonParser(_: FastifyRequest, body: string, done: ContentTypeParserDoneFunction) {
    try {
        var json = JSON.parse(body)
        done(null, json)
    } catch (err) {
        done(null, undefined)
    }
}

fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: 'string' }, (request: FastifyRequest, body: string, done) => {
    // on IOS, for some reason, requests to infodesk and openapi are JSON, but the content-type header is set as 'application/x-www-form-urlencoded'
    const routeUrl = request.routeOptions.url || ''
    if (routeUrl.startsWith("/openapi") || routeUrl.startsWith("/infodesk"))
        return jsonParser(request, body, done);

    try {
        const unpacked = unpack(Buffer.from(body, "base64"))
        done(null, unpacked)
    } catch (err) {
        done(err as Error, undefined)
    }
})
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, jsonParser)

// register plugins

//api
const apiPrefix = "/latest/api/index.php"
fastify.register(apiPlugin, { prefix: apiPrefix })
fastify.register(assetApiPlugin, { prefix: `${apiPrefix}/asset` })
fastify.register(toolApiPlugin, { prefix: `${apiPrefix}/tool` })
fastify.register(reproduceApiPlugin, { prefix: `${apiPrefix}/reproduce` })
fastify.register(tutorialApiPlugin, { prefix: `${apiPrefix}/tutorial` })
fastify.register(gachaApiPlugin, { prefix: `${apiPrefix}/gacha` })
fastify.register(partyApiPlugin, { prefix: `${apiPrefix}/party` })
fastify.register(expodApiPlugin, { prefix: `${apiPrefix}/expod` })
fastify.register(storyQuestApiPlugin, { prefix: `${apiPrefix}/story_quest` })
fastify.register(questApiPlugin, { prefix: `${apiPrefix}/quest` })
fastify.register(optionApiPlugin, { prefix: `${apiPrefix}/option` })
fastify.register(singleBattleQuestApiPlugin, { prefix: `${apiPrefix}/single_battle_quest` })
fastify.register(multiBattleQuestApiPlugin, { prefix: `${apiPrefix}/multi_battle_quest` })
fastify.register(attentionApiPlugin, { prefix: `${apiPrefix}/attention` })
fastify.register(characterApiPlugin, { prefix: `${apiPrefix}/character` })
fastify.register(partyGroupApiPlugin, { prefix: `${apiPrefix}/party_group` })
fastify.register(equipmentApiPlugin, { prefix: `${apiPrefix}/equipment` })
fastify.register(exBoostApiPlugin, { prefix: `${apiPrefix}/ex_boost` })
fastify.register(boxGachaApiPlugin, { prefix: `${apiPrefix}/box_gacha` })
fastify.register(shopApiPlugin, { prefix: `${apiPrefix}/shop` })
fastify.register(encyclopediaApiPlugin, { prefix: `${apiPrefix}/encyclopedia` })
fastify.register(mailApiPlugin, { prefix: `${apiPrefix}/mail` })
fastify.register(rankingEventApiPlugin, { prefix: `${apiPrefix}/ranking_event` })
fastify.register(missionApiPlugin, { prefix: `${apiPrefix}/mission` })
fastify.register(paymentApiPlugin, { prefix: `${apiPrefix}/payment` })
fastify.register(newsApiPlugin, { prefix: `${apiPrefix}/news` })
fastify.register(raidEventApiPlugin, { prefix: `${apiPrefix}/event/raid` })
fastify.register(rushEventApiPlugin, { prefix: `${apiPrefix}/event/rush` })

// openapi
fastify.register(openapiPlugin, { prefix: "/openapi/service" })

// infodesk
fastify.register(infodeskPlugin, { prefix: "/infodesk" })

// web routes
fastify.register(indexWebPlugin, { prefix: "/" })

// web api routes
fastify.register(indexWebApiPlugin, { prefix: "/api" })

// web static
fastify.register(fastifyStatic, {
    root: path.join(__dirname, "..", "web/public"),
    prefix: "/public",
    decorateReply: false
})

// static CDN
const cdnDir = process.env.CDN_DIR || ".cdn"
fastify.register(fastifyStatic, {
    root: path.isAbsolute(cdnDir) ? cdnDir : path.join(__dirname, "..", process.env.CDN_DIR || ".cdn"),
    prefix: "/patch/Live/2.0.0",
    decorateReply: false
})

// listen
const listenHost = process.env.LISTEN_HOST ?? "localhost"

const envListenPort = process.env.LISTEN_PORT === undefined ? 8000 : Number.parseInt(process.env.LISTEN_PORT)
const listenPort = isNaN(envListenPort) ? 8000 : envListenPort
fastify.listen({ port: listenPort, host: listenHost }, (err, address) => {
    if (err) {
        console.error(err)
        fastify.log.error(err)
        process.exit(1)
    }
    console.log(`StarPoint is listening on http://${listenHost}:${listenPort}`)
})

const logFile = path.join(__dirname, '..', 'multiplayer_log.txt');
function logToFile(msg: string) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
}

let connectedSockets: net.Socket[] = [];
let roomMates: any[] = [];
function syncRoomMates() { multiplayerState.roomMates = roomMates; }
let socketToConnectionId = new Map<net.Socket, string>();
let socketToSocklet = new Map<net.Socket, string>();



function broadcastToRoom(messageObj: any) {
    const replyStr = JSON.stringify(messageObj);
    logToFile(`[MULTIPLAYER] Broadcasting: ${replyStr}`);
    const replyBuffer = Buffer.from(replyStr, 'utf-8');
    const zeroByte = Buffer.from([0x00]);
    const payload = Buffer.concat([replyBuffer, zeroByte]);
    
    for (const client of connectedSockets) {
        if (!client.destroyed) {
            client.write(payload);
        }
    }
}

// Dummy TCP Server logic
const tcpServer = net.createServer((socket) => {
    logToFile(`[MULTIPLAYER] Client connected to TCP port 8082 from ${socket.remoteAddress}`);
    
    connectedSockets.push(socket);
    
    let buffer = Buffer.alloc(0);
    let currentConnectionId = "";

    socket.on("data", (data) => {
        logToFile(`[MULTIPLAYER] Received ${data.length} bytes from ${socket.remoteAddress}`);
        
        buffer = Buffer.concat([buffer, data]);
        
        let nullIdx;
        while ((nullIdx = buffer.indexOf(0x00)) !== -1) {
            const messageBytes = buffer.subarray(0, nullIdx);
            buffer = buffer.subarray(nullIdx + 1);
            
            const messageStr = messageBytes.toString('utf-8');
            logToFile(`[MULTIPLAYER] Parsed Message: ${messageStr}`);
            
            try {
                const json = JSON.parse(messageStr);
                
                // Handle Initial Handshake
                if (json && (json.socklet === "cooperation_room" || json.socklet === "cooperation_battle")) {
                    logToFile(`[MULTIPLAYER] Handshake requested for ${json.socklet} room ${json.roomNumber}`);
                    
                    // Client usually sends a connectionId or we generate one
                    currentConnectionId = json.connectionId || "dummy_connection_" + Date.now();
                    socketToConnectionId.set(socket, currentConnectionId);
                    socketToSocklet.set(socket, json.socklet);
                    
                    const acceptResponse = [0, currentConnectionId, json.roomNumber];
                    const replyStr = JSON.stringify(acceptResponse);
                    
                    logToFile(`[MULTIPLAYER] Sending Handshake Accept: ${replyStr}`);
                    
                    const replyBuffer = Buffer.from(replyStr, 'utf-8');
                    const zeroByte = Buffer.from([0x00]);
                    socket.write(Buffer.concat([replyBuffer, zeroByte]));
                    continue;
                }
                
                // Handle Array-based Messages
                if (Array.isArray(json) && json.length > 0) {
                    const socklet = socketToSocklet.get(socket);
                    
                    if (socklet === "cooperation_battle") {
                        const type = json[0];
                        if (type === 0 && Array.isArray(json[1])) {
                            // Client2Server.Notify(param1:BattleNotifyMessage)
                            const notifyMsg = json[1];
                            const notifyType = notifyMsg[0];
                            logToFile(`[BATTLE] Processing Notify Type: ${notifyType} from ${currentConnectionId}`);
                            
                            if (notifyType === 0) {
                                // BattleNotifyMessage.SceneReady
                                logToFile(`[BATTLE] Client ${currentConnectionId} is SceneReady. Sending BattleStart.`);
                                const battleStartResponse = [1, [1]]; // BattleServer2Client.Message(BattleServerMessage.BattleStart())
                                const battleStartStr = JSON.stringify(battleStartResponse);
                                const battleStartPayload = Buffer.concat([Buffer.from(battleStartStr, 'utf-8'), Buffer.from([0x00])]);
                                
                                socket.write(battleStartPayload);
                            } else if (notifyType === 1) {
                                // BattleNotifyMessage.Finalize
                                logToFile(`[BATTLE] Client ${currentConnectionId} sent Finalize.`);
                                const finalResponse = [1, [2]]; // BattleServer2Client.Message(BattleServerMessage.Finalized())
                                const finalStr = JSON.stringify(finalResponse);
                                const finalPayload = Buffer.concat([Buffer.from(finalStr, 'utf-8'), Buffer.from([0x00])]);
                                
                                socket.write(finalPayload);
                            } else if (notifyType === 2) {
                                // BattleNotifyMessage.Measurement(currentFrame, time)
                                const frame = notifyMsg[1];
                                const time = notifyMsg[2];
                                logToFile(`[BATTLE] Client ${currentConnectionId} sent Measurement frame=${frame} time=${time}`);
                                // Reply with BattleServerMessage.Measurement(frame, sentTime, threshold)
                                // threshold is the max acceptable roundtrip time in ms
                                const measurementResponse = [1, [3, frame, time, 10000]];
                                const measurementStr = JSON.stringify(measurementResponse);
                                const measurementPayload = Buffer.concat([Buffer.from(measurementStr, 'utf-8'), Buffer.from([0x00])]);
                                socket.write(measurementPayload);
                            } else if (notifyType === 4) {
                                // BattleNotifyMessage.Heartbeat - reply with AckHeartbeat
                                // For battle socket, AckHeartbeat is index 5 in BattleServerMessage 
                                // Actually, battle socket doesn't have AckHeartbeat - just ignore
                                logToFile(`[BATTLE] Client ${currentConnectionId} sent Heartbeat. Ignoring.`);
                            } else if (notifyType === 3) {
                                // BattleNotifyMessage.LineSpeedWarning(latency)
                                const latency = notifyMsg[1];
                                logToFile(`[BATTLE] Client ${currentConnectionId} sent LineSpeedWarning latency=${latency}`);
                                // Broadcast to all other clients: BattleServerMessage.LineSpeedWarning(connectionId, latency)
                                const warningResponse = [1, [4, currentConnectionId, latency]];
                                const warningStr = JSON.stringify(warningResponse);
                                const warningPayload = Buffer.concat([Buffer.from(warningStr, 'utf-8'), Buffer.from([0x00])]);
                                for (const client of connectedSockets) {
                                    if (client !== socket && !client.destroyed && socketToSocklet.get(client) === "cooperation_battle") {
                                        client.write(warningPayload);
                                    }
                                }
                            } else {
                                logToFile(`[BATTLE] Unhandled Notify Type: ${notifyType}`);
                            }
                        } else if (type === 1 && Array.isArray(json[1])) {
                            // Client2Server.Broadcast(messages: Array)
                            logToFile(`[BATTLE] Client ${currentConnectionId} sent Broadcast with ${json[1].length} messages`);
                            // Server replies with BattleServer2Client.Messages(senderConnectionId, messagesArray) -> [2, connId, array]
                            const broadcastResponse = [2, currentConnectionId, json[1]];
                            const broadcastStr = JSON.stringify(broadcastResponse);
                            const broadcastPayload = Buffer.concat([Buffer.from(broadcastStr, 'utf-8'), Buffer.from([0x00])]);
                            
                            for (const client of connectedSockets) {
                                if (client !== socket && !client.destroyed && socketToSocklet.get(client) === "cooperation_battle") {
                                    client.write(broadcastPayload);
                                }
                            }
                        } else {
                            logToFile(`[BATTLE] Unknown message type: ${type} data: ${JSON.stringify(json)}`);
                        }
                    } else {
                        const type = json[0];
                        if (type === 0 && Array.isArray(json[1])) {
                            // Client2Server.Notify(param1:MeetingNotifyMessage)
                            const notifyMsg = json[1];
                            const notifyType = notifyMsg[0];
                            logToFile(`[MULTIPLAYER] Processing Notify Type: ${notifyType}`);
                            
                            if (notifyType === 0) {
                                // MeetingNotifyMessage.Enter(mate, ...)
                                const currentMate = notifyMsg[1];
                                currentMate.connectionId = currentConnectionId;
                                logToFile(`[MULTIPLAYER] Client sent Enter with Mate: ${currentMate.name}`);
                                
                                // Handle role assignment for real players
                                const isHost = currentMate.viewerId === multiplayerState.activeRoom.hostViewerId;
                                
                                // Remove any existing entry for this player
                                roomMates = roomMates.filter(m => m.viewerId !== currentMate.viewerId);
                                
                                if (isHost) {
                                    currentMate.playerRoleKind = 1;
                                    currentMate.state = [1]; // Host is always Ready
                                } else {
                                    // Find available role (2 or 3)
                                    const usedRoles = roomMates.map(m => m.playerRoleKind);
                                    let nextRole = 2;
                                    while (usedRoles.includes(nextRole)) nextRole++;
                                    currentMate.playerRoleKind = nextRole;
                                }
                                
                                roomMates.push(currentMate);
                                multiplayerState.activeRoom.matesCount = roomMates.length;
                                
                                // Sort players by role so the Host (Role 1) is always first in the UI
                                roomMates.sort((a, b) => a.playerRoleKind - b.playerRoleKind);
                                syncRoomMates();
                                
                                // 1. Send Welcome to THIS client
                                const hostMate = roomMates.find(m => m.playerRoleKind === 1) || currentMate;
                                let leaderCharacterId = 111005;
                                if (hostMate.party && hostMate.party.characters && hostMate.party.characters[0] && hostMate.party.characters[0][1]) {
                                    leaderCharacterId = hostMate.party.characters[0][1].id || 111005;
                                }

                                const roomInfo = {
                                    "room_number": multiplayerState.activeRoom.roomNumber,
                                    "quest_id": multiplayerState.activeRoom.questId,
                                    "category_id": multiplayerState.activeRoom.categoryId,
                                    "host_entry_time": hostMate.entryTime || new Date().getTime(),
                                    "ip_address": "198.51.100.141",
                                    "port": 8082,
                                    "raising_state": 1,
                                    "room_sequence": 1,
                                    "is_pickup": false,
                                    "establisher_name": hostMate.name || "Player",
                                    "establisher_character": leaderCharacterId,
                                    "establisher_character_evolution_img_level": 1,
                                    "establisher_follow": 0,
                                    "mates": roomMates.length
                                }; 
                                const welcomeResponse = [1, [0, roomInfo, roomMates]];
                                const welcomeStr = JSON.stringify(welcomeResponse);
                                logToFile(`[MULTIPLAYER] Sending Welcome: ${welcomeStr}`);
                                socket.write(Buffer.concat([Buffer.from(welcomeStr, 'utf-8'), Buffer.from([0x00])]));
                                
                                // 2. Broadcast Mates to ALL OTHER clients
                                const matesResponse = [1, [1, roomMates]];
                                const matesStr = JSON.stringify(matesResponse);
                                const matesPayload = Buffer.concat([Buffer.from(matesStr, 'utf-8'), Buffer.from([0x00])]);
                                
                                for (const client of connectedSockets) {
                                    if (client !== socket && !client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                                        client.write(matesPayload);
                                    }
                                }
                            } else if (notifyType === 2) {
                                // MeetingNotifyMessage.ChangeParty(mate, ...)
                                const updatedMate = notifyMsg[1];
                                updatedMate.connectionId = currentConnectionId;
                                
                                // Client's getMate() defaults to state:[0]. Enforce Host's state back to Ready [1]!
                                if (multiplayerState.activeRoom.hostViewerId === updatedMate.viewerId) {
                                    updatedMate.state = [1];
                                }
                                
                                logToFile(`[MULTIPLAYER] Client sent ChangeParty (Full Mate Update) for ${updatedMate.name}`);
                                
                                // Update mate in the room
                                const mateIndex = roomMates.findIndex(m => m.connectionId === currentConnectionId);
                                if (mateIndex !== -1) {
                                    roomMates[mateIndex] = updatedMate;
                                    syncRoomMates();
                                }
                                
                                // Broadcast Mates to ALL clients
                                const matesResponse = [1, [1, roomMates]];
                                const matesStr = JSON.stringify(matesResponse);
                                const matesPayload = Buffer.concat([Buffer.from(matesStr, 'utf-8'), Buffer.from([0x00])]);
                                
                                // If it's the host, we also need to broadcast StateChanged so the host's client locally returns to Ready
                                let stateChangedPayload: Buffer | null = null;
                                if (multiplayerState.activeRoom.hostViewerId === updatedMate.viewerId) {
                                    const stateChangedResponse = [1, [2, currentConnectionId, [1]]]; // MeetingServerMessage.StateChanged(connId, ReadyState.Ready)
                                    const stateChangedStr = JSON.stringify(stateChangedResponse);
                                    stateChangedPayload = Buffer.concat([Buffer.from(stateChangedStr, 'utf-8'), Buffer.from([0x00])]);
                                }
                                
                                for (const client of connectedSockets) {
                                    if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                                        client.write(matesPayload);
                                        if (stateChangedPayload) {
                                            client.write(stateChangedPayload);
                                        }
                                    }
                                }
                            } else if (notifyType === 1) {
                                // MeetingNotifyMessage.Leave
                                logToFile(`[MULTIPLAYER] Client sent Leave`);
                                
                                const isHostLeave = roomMates.find(m => m.connectionId === currentConnectionId)?.viewerId === multiplayerState.activeRoom?.hostViewerId;
                                
                                roomMates = roomMates.filter(m => m.connectionId !== currentConnectionId);
                                multiplayerState.activeRoom.matesCount = roomMates.length;
                                syncRoomMates();
                                
                                if (isHostLeave) {
                                    logToFile(`[MULTIPLAYER] Host left. Broadcasting Disbanded.`);
                                    const disbandResponse = [1, [6, "multibattle_room_dismiss_connection_error"]]; // MeetingServerMessage.Disbanded("...")
                                    const disbandStr = JSON.stringify(disbandResponse);
                                    const disbandPayload = Buffer.concat([Buffer.from(disbandStr, 'utf-8'), Buffer.from([0x00])]);
                                    
                                    for (const client of connectedSockets) {
                                        if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                                            client.write(disbandPayload);
                                        }
                                    }
                                    multiplayerState.activeRoom.hostViewerId = 0;
                                    multiplayerState.activeRoom.matesCount = 0;
                                    roomMates = [];
                                    syncRoomMates();
                                } else {
                                    const matesResponse = [1, [1, roomMates]];
                                    const matesStr = JSON.stringify(matesResponse);
                                    logToFile(`[MULTIPLAYER] Broadcasting Mates Update after Leave`);
                                    const matesPayload = Buffer.concat([Buffer.from(matesStr, 'utf-8'), Buffer.from([0x00])]);
                                    
                                    for (const client of connectedSockets) {
                                        if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                                            client.write(matesPayload);
                                        }
                                    }
                                }
                            } else if (notifyType === 3) {
                                // MeetingNotifyMessage.Ready (ChangeState)
                                const readyState = notifyMsg[1];
                                logToFile(`[MULTIPLAYER] Client sent ReadyState: ${JSON.stringify(readyState)}`);
                                
                                const mateIndex = roomMates.findIndex(m => m.connectionId === currentConnectionId);
                                if (mateIndex !== -1) {
                                    roomMates[mateIndex].state = readyState;
                                }
                                
                                // Broadcast StateChanged(connectionId, readyState)
                                // MeetingServerMessage index 2 is StateChanged
                                const stateChangedResponse = [1, [2, currentConnectionId, readyState]];
                                const stateChangedStr = JSON.stringify(stateChangedResponse);
                                logToFile(`[MULTIPLAYER] Broadcasting StateChanged: ${stateChangedStr}`);
                                const stateChangedPayload = Buffer.concat([Buffer.from(stateChangedStr, 'utf-8'), Buffer.from([0x00])]);
                                
                                for (const client of connectedSockets) {
                                    if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                                        client.write(stateChangedPayload);
                                    }
                                }
                            } else if (notifyType === 7) {
                                // MeetingNotifyMessage.ChangeAutoplayMode
                                logToFile(`[MULTIPLAYER] Client sent ChangeAutoplayMode. Broadcasting AutoplayModeChanged.`);
                                const p1 = notifyMsg[1];
                                const p2 = notifyMsg[2];
                                // MeetingServerMessage index 3 is AutoplayModeChanged
                                const autoResponse = [1, [3, currentConnectionId, p1, p2]];
                                const autoStr = JSON.stringify(autoResponse);
                                const autoPayload = Buffer.concat([Buffer.from(autoStr, 'utf-8'), Buffer.from([0x00])]);
                                for (const client of connectedSockets) {
                                    if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") client.write(autoPayload);
                                }
                            } else if (notifyType === 6) {
                                // MeetingNotifyMessage.StartBattle
                                logToFile(`[MULTIPLAYER] Client sent StartBattle. Broadcasting Start...`);
                                // Snapshot roomMates for the finish endpoint (survives TCP disconnects)
                                multiplayerState.lastBattleRoomMates = JSON.parse(JSON.stringify(roomMates));
                                logToFile(`[MULTIPLAYER] Saved lastBattleRoomMates snapshot: ${multiplayerState.lastBattleRoomMates.length} mates`);
                                const startResponse = [1, [5, roomMates]];
                                const startStr = JSON.stringify(startResponse);
                                const startPayload = Buffer.concat([Buffer.from(startStr, 'utf-8'), Buffer.from([0x00])]);
                                for (const client of connectedSockets) {
                                    if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") client.write(startPayload);
                                }
                            } else if (notifyType === 4) {
                                // MeetingNotifyMessage.Heartbeat
                                // Send MeetingServer2Client.Message(MeetingServerMessage.AckHeartbeat(connectionId))
                                const ackResponse = [1, [10, currentConnectionId]];
                                const replyStr = JSON.stringify(ackResponse);
                                logToFile(`[MULTIPLAYER] Sending AckHeartbeat: ${replyStr}`);
                                
                                const replyBuffer = Buffer.from(replyStr, 'utf-8');
                                const zeroByte = Buffer.from([0x00]);
                                socket.write(Buffer.concat([replyBuffer, zeroByte]));
                            } else {
                                logToFile(`[MULTIPLAYER] Unhandled Notify Type: ${notifyType}`);
                            }
                        }
                    }
                }
            } catch (e) {
                logToFile(`[MULTIPLAYER] Error parsing JSON: ${(e as Error).message}`);
            }
        }
    });

    socket.on("error", (err) => {
        logToFile(`[MULTIPLAYER] Socket error from ${socket.remoteAddress}: ${err.message}`);
    });

    socket.on("close", () => {
        const disconnectedSocklet = socketToSocklet.get(socket);
        const connId = socketToConnectionId.get(socket);
        logToFile(`[MULTIPLAYER] Client disconnected from ${socket.remoteAddress} (socklet=${disconnectedSocklet}, connId=${connId})`);
        
        // Remove socket
        connectedSockets = connectedSockets.filter(s => s !== socket);
        socketToConnectionId.delete(socket);
        socketToSocklet.delete(socket);
        
        if (connId) {
            if (disconnectedSocklet === "cooperation_battle") {
                // Battle socket disconnected - send Leave to remaining battle sockets
                // BattleServerMessage.Leave(connectionId) = index 0
                const leaveResponse = [1, [0, connId]];
                const leaveStr = JSON.stringify(leaveResponse);
                const leavePayload = Buffer.concat([Buffer.from(leaveStr, 'utf-8'), Buffer.from([0x00])]);
                logToFile(`[BATTLE] Broadcasting Leave for ${connId}`);
                
                for (const client of connectedSockets) {
                    if (!client.destroyed && socketToSocklet.get(client) === "cooperation_battle") {
                        client.write(leavePayload);
                    }
                }
            } else {
                // Room socket disconnected - update mates and broadcast to room sockets only
                roomMates = roomMates.filter(mate => mate.connectionId !== connId);
                multiplayerState.activeRoom.matesCount = roomMates.length;
                syncRoomMates();
                
                if (connectedSockets.some(s => socketToSocklet.get(s) !== "cooperation_battle")) {
                    const matesResponse = [1, [1, roomMates]];
                    const matesStr = JSON.stringify(matesResponse);
                    const matesPayload = Buffer.concat([Buffer.from(matesStr, 'utf-8'), Buffer.from([0x00])]);
                    for (const client of connectedSockets) {
                        if (!client.destroyed && socketToSocklet.get(client) !== "cooperation_battle") {
                            client.write(matesPayload);
                        }
                    }
                }
            }
        }
    });
});

tcpServer.on("error", (err) => {
    logToFile(`[MULTIPLAYER] Server Error: ${err.message}`);
});

tcpServer.listen(8082, listenHost, () => {
    logToFile(`[MULTIPLAYER] Dummy TCP Server listening on ${listenHost}:8082`);
});
