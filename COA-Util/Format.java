import java.util.*;
import java.util.regex.*;

public class Format {

    String EXCLUDE_DELIMITER_REGEX = "[\\(\\)\\[\\]\\<\\>]";
    String COA_CHAR_REGEX = "[a-zA-Z0-9~\\*]";
    String NOT_COA_CHAR_REGEX = "[^a-zA-Z0-9~\\*]";
    Pattern EXCLUDE_DELIMITER;
    Pattern COA_CHAR;

    int NUMBER_BASE = 10;
    int LETTER_BASE = 26;
    char WILDCARD = '~';
    char REPEATED_WILDCARD = '*';

    String[] KEY_NAME;
    int[] KEY_LEN, KEY_RANGE, START_POS;
    int ACCOUNT_LEN, MAX_DEPTH;
    String GLOBAL_REQUIREMENTS = "";

    public Format (String[] key_name,int[] key_len,String[] global_req) {
        EXCLUDE_DELIMITER = Pattern.compile(EXCLUDE_DELIMITER_REGEX);
        COA_CHAR = Pattern.compile(COA_CHAR_REGEX);

        KEY_NAME = key_name;
        KEY_LEN = key_len;
        if (global_req != null && global_req.length > 0){
            for(int i=0;i<global_req.length;i++){
                if(GLOBAL_REQUIREMENTS.length()>0) GLOBAL_REQUIREMENTS += " "+Constants.AND+" ";
                GLOBAL_REQUIREMENTS += global_req[i];
            }
        }

        MAX_DEPTH = key_len.length;
        KEY_RANGE = new int[MAX_DEPTH];
        START_POS = new int[MAX_DEPTH];
        int cur = 0;
        for(int i=0;i<key_len.length;i++){
            START_POS[i] = cur;
            KEY_RANGE[i] = (int)(key_len[i]>=0? Math.pow(NUMBER_BASE, key_len[i]) : Math.pow(LETTER_BASE, -key_len[i]));
            cur += Math.abs(key_len[i]);
        }
        ACCOUNT_LEN = cur;
    }
};