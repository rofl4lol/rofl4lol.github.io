class Utility {

    static TimeSinceAgo(oldTime: number) {
        var s = (Date.now() - oldTime) / 1000;
        var t = "";

        if (s < 60)
            t = "Less than a minute";
            //t = s.toFixed(0) + " seconds";
        else if (s < 60 * 60)
            t = (s / 60).toFixed(0) + " minutes";
        else if (s < 60 * 60 * 24)
            t = (s / 60 / 60).toFixed(1) + " hours";
        else
            t = (s / 60 / 60 / 24).toFixed(0) + " days";

        return t + " ago";
    }

    static TimeSinceDuration(oldTime: number) {
        var d = new Date(Date.now() - oldTime);

        var s = String(d.getUTCSeconds());
        if (d.getUTCSeconds() < 10)
            s = "0" + s;

        var m = String(d.getUTCMinutes());

        var t = m + ":" + s;

        if (d.getUTCHours() > 0) {
            if (d.getUTCMinutes() < 10)
                m = "0" + s;
            t = d.getUTCHours() + ":" + t;
        }

        return t;
    }

    static GetFriendlyDate(d: Date) {
        var month = "";
        switch (d.getMonth() + 1) {
            case 1: month = "Jan."; break;
            case 2: month = "Feb."; break;
            case 3: month = "Mar."; break;
            case 4: month = "Apr."; break;
            case 5: month = "May"; break;
            case 6: month = "June"; break;
            case 7: month = "July"; break;
            case 8: month = "Aug."; break;
            case 9: month = "Sep."; break;
            case 10: month = "Oct."; break;
            case 11: month = "Nov."; break;
            case 12: month = "Dec.";
        }

        var min = String(d.getMinutes());
        if (d.getMinutes() < 10)
            min = "0" + min;
        return month + " " + d.getDate() + ", " + d.getFullYear()
            + " " + d.getHours() + ":" + min;
    }
}

export = Utility; 