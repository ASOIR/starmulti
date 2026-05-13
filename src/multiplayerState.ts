export const multiplayerState = {
    activeRoom: {
        questId: 1034005,
        categoryId: 2,
        roomNumber: "123456",
        hostViewerId: 0,
        matesCount: 0
    },
    roomMates: [] as any[],
    // Snapshot of roomMates taken when battle starts, survives TCP disconnects
    lastBattleRoomMates: [] as any[]
};
