class DashManifestModelMock {

    constructor() {}

    getIsTextTrack() {
        return false;
    }

    getAdaptationForType() {
        return {
            Representation: [
                {
                    width: 500,
                    bandwidth: 1000
                },
                {
                    width: 750,
                    bandwidth: 2000
                },
                {
                    width: 900,
                    bandwidth: 3000
                }
            ]
        };
    }

    setRepresentation(res) {
        this.representation = res;
    }

    getRepresentationsForAdaptation() {
        if (this.representation) {
            return [this.representation];
        } else {
            return [];
        }
    }
}

export default DashManifestModelMock;
