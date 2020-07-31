import java.util.*;
import java.util.regex.*;

public class Main{

    // public static void main(String[] args){
        

    //     Scanner sc = new Scanner(System.in);
    //     String code = sc.nextLine();
    //     System.out.println(generate_query(code, BalanceSheet));
    //     sc.close();
    // }

    static Format BalanceSheet = new Format(
        new String[]{"MIS_ACCOUNT_TYPE_KEY", "MIS_FUND_TYPE_KEY", "MIS_LEVEL_2_KEY", "MIS_LEVEL_3_KEY"},
        new int[]{1, 1, 1, 2},
        new String[0]
    );

    static Format PrimaryAccount = new Format(
        new String[]{"MIS_ACCOUNT_TYPE_KEY", "MIS_FUND_TYPE_KEY", "MIS_LEVEL_2_KEY", "MIS_LEVEL_3_KEY", "MIS_LEVEL_4_KEY", "MIS_LEVEL_5_KEY"},
        new int[]{1, 1, 1, 2, 2, 2},
        new String[0]
    );

    static Format SecondaryAccount = new Format(
        new String[]{"SC_TYPE_KEY", "SC_BROAD_GROUP_KEY", "SC_NATURE_KEY", "SC_DETAIL_1_KEY"},
        new int[]{-1, 1, 2, 2},
        new String[0]
    );

    static Format FinancialAccount = new Format(
        new String[]{"SC_BROAD_GROUP_KEY", "SC_NATURE_KEY", "SC_DETAIL_1_KEY"},
        new int[]{1,2,2},
        new String[]{"SC_TYPE_KEY=\'F\'"}
    );

    static Format StatisticalAccount = new Format(
        new String[]{"SC_BROAD_GROUP_KEY", "SC_NATURE_KEY", "SC_DETAIL_1_KEY"},
        new int[]{1,2,2},
        new String[]{"SC_TYPE_KEY=\'S\'"}
    );

    static Format UnspecifiedSecondaryAccount = new Format(
        new String[]{"SC_BROAD_GROUP_KEY", "SC_NATURE_KEY", "SC_DETAIL_1_KEY"},
        new int[]{1,2,2},
        new String[0]
    );

    public static String generate_db_query(String url){
        if(url.charAt(0)=='/') url = url.substring(1);
        String[] tmp = url.split("\\/");
        String DB = tmp[0];
        String[] tokens = tmp[1].split("\\&");
        String PA = "", SA = "", prev_token = "", AP = "", HFK = "";

        for(int i=0;i<tokens.length;i++){
            String[] cur = tokens[i].split("=");
            switch(cur[0]){
                case "A_P":
                    AP = cur[1];
                    break;
                case "ORG_ID":
                    HFK = cur[1];
                    break;
                case "include":
                    PA += cur[1]+"_";
                    break;
                case "pa":
                    PA += cur[1]+"_";
                    break;
                case "sa":
                    SA += cur[1]+"_";
                    break;
                case "exclude":
                    if(prev_token.equals("sa"))
                        SA += "["+cur[1]+"]_";
                    else
                        PA += "["+cur[1]+"]_";
                    break;
            }
            prev_token = cur[0];
        }

        PA = PA.toLowerCase().replaceAll("_", ",").replaceAll("to", " to ");
        SA = SA.toLowerCase().replaceAll("_", ",").replaceAll("to", " to ");
        // detect any string that isn't 'to'
        Boolean FA = !COAUtil.regex_match(SA, Pattern.compile("(?<![a-z])[a-z]+(?![a-z])(?<!to)"));

        String PA_exp = COAUtil.generate_query(PA, PrimaryAccount);
        String SA_exp = (SA.length()>0)? COAUtil.generate_query(SA, (FA? FinancialAccount : SecondaryAccount)) : "";
        if(PA_exp.length()>0 && SA_exp.length()>0) PA_exp += " AND ";
        PA_exp += SA_exp;

        return Constants.SELECT + " HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD, SUM(YTD_BUDGET_AMOUNT)\n"
            + Constants.FROM + " " +  DB + "\n"
            + Constants.WHERE  + " ACCOUNTING_PERIOD " + Constants.LIKE + " \'%" + AP + "\' " + Constants.AND + " HEALTH_FACILITY_KEY" + Constants.EQUALS + HFK + " " + Constants.AND + "\n"
            + "\t" + PA_exp + "\n"
            + Constants.GROUP_BY + " HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD\n";
        // return PA_exp;
    }

    public static void main(String[] args){
        Scanner sc = new Scanner(System.in);
        String inp = sc.nextLine();
        System.out.println(generate_db_query(inp));
        sc.close();
    }

}