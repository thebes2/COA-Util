import java.util.*;
import java.util.regex.*;

public class COAUtil {

    public static int ctoi(char x){
        return 'A'<=x&&x<='Z'? (int)(x)-91 : (int)(x-'0');
    }

    public static String itoc(int x,int len){
        if(x>=0) return Integer.toString(x);
        x = -(x+1);
        String ret = "";
        while(len>0) {
            len--;
            ret = Character.toString((char)(65+(x%26)))+ret;
            x = (int)Math.floor((double)x/(double)26);
        }
        return ret;
    }

    public static String pad(int x,int len){
        String s = itoc(x, len);
        while(s.length() < len) s = "0"+s;
        return s;
    }

    public static String expand(String selector,Format format){
        if(selector.endsWith(Character.toString(format.REPEATED_WILDCARD))){
            if(format.ACCOUNT_LEN-selector.length()+1<0){
                // throw ArgumentError;
                System.out.println("Argument Length invalid.");
            }
            else{
                String tmp = "";
                for(int i=0;i<format.ACCOUNT_LEN-selector.length()+1;i++)
                    tmp += format.WILDCARD;
                selector = selector.replace(Character.toString(format.REPEATED_WILDCARD), tmp);
            }
        }
        else if(format.ACCOUNT_LEN<selector.length()){
            // GG it's going to RTE
            System.out.println("Argument Length invalid.");
        }
        else if(format.ACCOUNT_LEN>selector.length()){
            // not exactly optimal but handles BA and PA so good enough
            while(selector.length()<format.ACCOUNT_LEN)
                selector += format.WILDCARD;
        }
        return selector;
    }

    public static String replace(String str,int idx,char ch){
        return str.substring(0,idx)+ch+str.substring(idx+1);
    }

    public static String add(String str,int idx,int val){
        for(int i=idx;i>=0;i--){
            if(str.charAt(i)>'9'||str.charAt(i)<'0') continue;
            int cur = (int)(str.charAt(i)-'0')+val;
            str = replace(str, i, (char)((cur+10)%10+'0'));
            if(cur<0) val = -1;
            else if(cur>9) val = 1;
            else val = 0;
        }
        if(val==1) str = "1"+str;
        while(str.charAt(0)=='0') str = str.substring(1);
        return str;
    }

    public static Boolean less(String a,String b){
        if(a.length()!=b.length()) return a.length()<b.length();
        else return a.compareTo(b)<0;
    }

    public static Boolean leq(String a,String b){
        if(a.length()!=b.length()) return a.length()<b.length();
        else return a.compareTo(b)<=0;
    }

    public static Boolean regex_match(String text,Pattern regex){
        Matcher m = regex.matcher(text);
        return m.find();
    }

    public static List<String> parse_token(String token,Format format){
        List<String> ret = new ArrayList<String>();
        token = token.trim();
        if(token.length()>0){
            for(int i=0;i+1<token.length();i++){
                if(token.charAt(i)==format.REPEATED_WILDCARD&&regex_match(token.substring(i+1,i+2),format.COA_CHAR))
                    token = replace(token, i, format.WILDCARD);
            }
            if(token.indexOf(Constants.TO)!=-1){
                String[] temp = token.split(Constants.TO);
                String from = temp[0].trim(), to = temp[1].trim();
                int prefix = Math.min(from.length(), to.length());
                from = expand(from, format);
                to = expand(to, format);

                String lcs = "";
                while(from.length()>0 && from.charAt(from.length()-1)==format.WILDCARD && to.charAt(to.length()-1)==format.WILDCARD){
                    lcs = from.charAt(from.length()-1) + lcs;
                    from = from.substring(0, from.length()-1);
                    to = to.substring(0, to.length()-1);
                }

                for(int i=prefix-1;i<from.length();i++){
                    if(from.charAt(i)==format.WILDCARD&&to.charAt(i)!=format.WILDCARD)
                        from = replace(from, i, (to.charAt(i)>='0'&&to.charAt(i)<='9')? '0' : 'A');
                    if(to.charAt(i)==format.WILDCARD&&from.charAt(i)!=format.WILDCARD)
                        to = replace(to, i, (from.charAt(i)>='0'&&from.charAt(i)<='9')? '9' : 'Z');
                }

                for(int i=0;i<from.length();i++){
                    // there's ambiguity if internal wildcards don't match, so just throw an error
                    // GGWP
                    if((from.charAt(i)==format.WILDCARD)^(to.charAt(i)==format.WILDCARD))
                        System.out.println("Internal wildcards mismatch in \'to\' selector.");
                }

                to = add(to, to.length()-1, 1);

                while(less(from, to)){
                    int idx = 0;
                    for(int i=from.length()-1;i>=0;i--){
                        if(from.charAt(i)>'0' && from.charAt(i)<='9'){
                            idx = i;
                            break;
                        }
                    }
                    for(int i=idx;i<from.length();i++){
                        String next = add(from, i, 1);
                        if(leq(next, to)){
                            for(int j=i+1;j<from.length();j++)
                                from = replace(from, j, format.WILDCARD);
                            ret.add(from+lcs);
                            from = next;
                            break;
                        }
                    }
                }

            }
            else ret.add(expand(token, format));
        } 
        return ret;
    }

    public static void parse_query(String code,Format format,List<String> include,List<String> exclude){
        String[] segments = code.split(format.EXCLUDE_DELIMITER_REGEX, -1);

        for(int i=0;i<segments.length;i++){
            String[] tokens = segments[i].split(",");
            for(int j=0;j<tokens.length;j++){
                if((i&1)==1) exclude.addAll(parse_token(tokens[j], format));
                else include.addAll(parse_token(tokens[j], format));
            }
        }
    }

    public static String keyNameWrapper(String keyName){
        return "ltrim(rtrim(" + keyName + "))";
    }

    public static String innerExp(List<Integer> set,int keyLen){
        String ret = "";
        for(Integer i : set){
            if(ret.length()>0) ret += ",";
            ret += "\'"+pad(i, keyLen)+"\'";
        }
        return ret;
    }

    public static String inExp(List<Integer> set,String keyName,int keyLen){
        return keyNameWrapper(keyName) + (set.size()==1?
            Constants.EQUALS+"\'"+pad(set.get(0), keyLen)+"\'" :
            " "+Constants.IN+" ("+ innerExp(set, keyLen) + ")"
        );
    }

    public static String btwnExp(List<Integer> set,String keyName,int keyLen){
        String min = pad(Collections.min(set), keyLen);
        String max = pad(Collections.max(set), keyLen);
        if(min.compareTo(max)>0){
            String tmp = max; max = min; min = tmp;
        }
        return keyNameWrapper(keyName)+" "+Constants.BETWEEN+" \'"+min+"\' "+Constants.AND+" \'"+max+"\'";
    }

    public static Boolean shouldUseInterval(List<Integer> set,String keyName,int keyLen,Boolean isEmpty){
        String set_exp = isEmpty? inExp(set, keyName, keyLen) : innerExp(set, keyLen);
        String int_exp = btwnExp(set, keyName, keyLen);
        // arbitrary penalty for readability reduction when using BETWEEN
        return int_exp.length() + 4 < set_exp.length();
    }

    public static String generateSetExp(int depth,Set<Integer> transition,Format format){
        // split set into contiguous intervals and use either BETWEEN or IN for each
        List<List<Integer>> intervals = new ArrayList<List<Integer>>();
        List<Integer> set = new ArrayList<Integer>(), useSet = new ArrayList<Integer>();
        set.addAll(transition);
        for(int i=0,j;i<set.size();i=j){
            intervals.add(new ArrayList<Integer>());
            for(j=i;j<set.size()&&set.get(j)-j==set.get(i)-i;j++)
                intervals.get(intervals.size()-1).add(set.get(j));
        }
        String keyName = format.KEY_NAME[depth];
        int keyLen = Math.abs(format.KEY_LEN[depth]), cnt = 0;
        String exp1 = "", exp2 = "";
        for(int i=0;i<intervals.size();i++){
            if(shouldUseInterval(intervals.get(i), keyName, keyLen, exp1.length()==0)){
                if(exp2.length()>0) exp2 += " "+Constants.OR+" ";
                exp2 += btwnExp(intervals.get(i), keyName, keyLen);
                cnt ++;
            }
            else useSet.addAll(intervals.get(i));
        }
        if(useSet.size()>0) exp1 = inExp(useSet, keyName, keyLen);
        if(exp1.length()>0&&exp2.length()>0){
            exp1 += " "+Constants.OR+" ";
            cnt += 100;
        }
        exp1 += exp2;
        if(cnt>1) exp1 = "("+exp1+")";
        return exp1;
    }

    public static Pair<String,Integer> dfs(int depth,List<QueryPath> paths,Format format){
        if(depth==format.MAX_DEPTH || paths.size()==0) return new Pair<String,Integer>("", 0);
        String exp = "";
        int childnum = 0;
        List<List<QueryPath>> children = new ArrayList<List<QueryPath>>();
        HashMap<Set<Integer>,Integer> map = new HashMap<Set<Integer>,Integer>();

        for(int i=0;i<paths.size();i++){
            QueryPath cur = paths.get(i);
            if(cur.path.get(depth).size()==0) continue;
            if(!map.containsKey(cur.path.get(depth))){
                map.put(cur.path.get(depth), children.size());
                children.add(new ArrayList<QueryPath>());
            }
            children.get(map.get(cur.path.get(depth))).add(cur);
        }
        for(Set<Integer> transition : map.keySet()){
            List<QueryPath> child = children.get(map.get(transition));
            Pair<String,Integer> result = dfs(depth+1, child, format);
            String childexp = result.first;
            int childchildnum = result.second;

            if(transition.size()==format.KEY_RANGE[depth]){
                if(childexp.length()>0){
                    if(exp.length()>0) exp = exp + " " + Constants.OR + " ";
                    exp = exp + childexp;
                    if(childnum==0) childnum = childchildnum;
                    else childnum++;
                }
            }
            else{
                if(childexp.length()>0){
                    if(exp.length()>0) exp = exp + " " + Constants.OR + " ";
                    if(childchildnum > 1) childexp = "(" + childexp + ")";
                    exp = exp + generateSetExp(depth, transition, format) + " " + Constants.AND + " " + childexp;
                }
                else{
                    if(exp.length()>0) exp = exp + " " + Constants.OR + " ";
                    exp = exp + generateSetExp(depth, transition, format);
                }
                childnum ++;
            }
        }
        return new Pair<String,Integer>(exp, childnum);
    }

    public static String generate_expression(List<String> selectors,Format format){
        List<QueryPath> paths = new ArrayList<QueryPath>();
        for(int i=0;i<selectors.size();i++)
            paths.add(new QueryPath(selectors.get(i), format));
        for(int i=format.MAX_DEPTH-1;i>=0;i--){
            List<QueryPath> result = new ArrayList<QueryPath>();
            for(int j=0;j<paths.size();j++){
                boolean done = false;
                for(int k=0;k<result.size();k++){
                    if(result.get(k).similar(paths.get(j), i)){
                        result.get(k).path.get(i).addAll(paths.get(j).path.get(i));
                        done = true;
                        break;
                    }
                }
                if(!done) result.add(paths.get(j));
            }
            paths = result;
        }

        Pair<String,Integer> res = dfs(0, paths, format);
        String exp = res.first;
        return res.second>1? "("+exp+")" : exp;
    }

    public static String negate_expression(String exp){
        return Constants.NOT+" ("+exp+")";
    }

    public static String generate_query(String code,Format format) {
        String coa = format.COA_CHAR_REGEX;
        String not_coa = format.NOT_COA_CHAR_REGEX;
        String pat = "(?<!"+coa+")[A-Z]+(?!"+coa+")(?<!"+not_coa+"TO)";
        code = code.toUpperCase().replaceAll(pat, "");
        //System.out.println(code);

        List<String> include_selectors = new ArrayList<String>();
        List<String> exclude_selectors = new ArrayList<String>();
        parse_query(code, format, include_selectors, exclude_selectors);

        String include_exp = generate_expression(include_selectors, format);
        String exclude_exp = generate_expression(exclude_selectors, format);
        if(include_exp.length()==0) include_exp = exclude_exp;
        else if(exclude_exp.length()>0) include_exp += " "+Constants.AND+" "+negate_expression(exclude_exp);
        if(format.GLOBAL_REQUIREMENTS.length()>0&&include_exp.length()>0) include_exp = format.GLOBAL_REQUIREMENTS+" "+Constants.AND+"\n\t"+include_exp;
        else if(include_exp.length()==0) include_exp = format.GLOBAL_REQUIREMENTS;
        return include_exp;
    }

}