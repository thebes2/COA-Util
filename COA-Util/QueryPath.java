import java.util.*;

public class QueryPath {

    public List<Set<Integer>> path;

    public static String itoc(int x,int len){
        if(x>=0) return Integer.toString(x);
        x = -(x+1);
        String ret = "";
        while(len>0) {
            len--;
            ret = Character.toString((char)(65+(x%26)))+ret;
            x = (int)x/26;
        }
        return ret;
    }

    public static String pad(int x,int len){
        String s = itoc(x, len);
        while(s.length() < len) s = "0"+s;
        return s;
    }

    public static Boolean match(String selector,String pattern){
        if(selector.length()!=pattern.length()) return false;
        for(int i=0;i<selector.length();i++){
            if(selector.charAt(i)!='~'&&selector.charAt(i)!=pattern.charAt(i)) return false;
        }
        return true;
    }

    public QueryPath(String selector,Format format){
        selector = selector.toUpperCase();
        path = new ArrayList<Set<Integer>>();

        for(int i=0;i<format.MAX_DEPTH;i++){
            path.add(new TreeSet<Integer>());
            String sub = selector.substring(format.START_POS[i], format.START_POS[i]+Math.abs(format.KEY_LEN[i]));
            int start = format.KEY_LEN[i]<0 ? -format.KEY_RANGE[i] : 0;
            int end = format.KEY_LEN[i]>0 ? format.KEY_RANGE[i] : 0;
            for(int j=start;j<end;j++){
                if(match(sub, pad(j, Math.abs(format.KEY_LEN[i]))))
                    path.get(i).add(j);
            }
        }
    }

    public Boolean similar(QueryPath other,int index){
        for(int i=0;i<path.size();i++){
            if(i != index && !path.get(i).equals(other.path.get(i))) return false;
        }
        return true;
    }

};